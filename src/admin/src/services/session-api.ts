import { ApiError } from "@giga/http/api-error";
import { createApi } from "@giga/http/create-api";
import type { FetchLike, RequestOptions } from "@giga/http/request-types";
import type { z } from "zod";
import { ERROR_SENTENCES, FAILURE_CODES, REFRESH_SKEW_MS } from "@/constants/api-sentences";
import { SESSION_ENDED_NOTICE } from "@/constants/sign-in-copy";
import type { SessionTokens } from "@/types/auth";
import type { EventArea } from "@/types/events";
import { ResetDoneSchema, ResetStartSchema } from "./schemas/reset-schema";
import { AnySchema, SessionSchema, tokensOf, type BackendSession } from "./schemas/session-schema";

/* The admin's request layer over `@giga/http`'s `createApi` (`29` sections 6.2 and 7): the bearer token from the in-memory
 * session, a refresh before an access token runs out, and ONE refresh when several requests meet a 401 together. The
 * refresh token is single-use and rides an httpOnly cookie the app cannot read, so the refresh is a shared promise and is
 * never retried; a reload restores the session with one probe of the same call (`restore`). A refresh that fails for any
 * reason ends the session. Pure of the store: the app wires it in `api.ts`, a test wires a fake fetch and clock. */

export interface SessionApiDeps {
  /** The one network call; `api.ts` supplies the global fetch, a test its own. */
  readonly fetch?: FetchLike;
  readonly now: () => number;
  readonly tokens: () => SessionTokens | null;
  /** A refresh answered: the new tokens replace the old whole. */
  readonly adopt: (tokens: SessionTokens) => void;
  /** The session cannot continue: clear it and show the gate with this sentence. */
  readonly end: (sentence: string) => void;
}

export type CallOptions = Pick<RequestOptions<EventArea>, "method" | "body" | "form" | "signal" | "area">;

export type StreamOptions = Pick<RequestOptions<EventArea>, "signal" | "quiet" | "area">;

export interface SessionApi {
  /** A signed-in call: the bearer, the proactive refresh, one retry after a refresh on a 401. */
  request: <T>(path: string, schema: z.ZodType<T>, options?: CallOptions) => Promise<T>;
  /** A signed-in GET whose body is read as a stream (`44` section 4), with the same refresh and retry as `request`. The
   *  body is the caller's to read and cancel; `signal` ends it. */
  stream: (path: string, options?: StreamOptions) => Promise<ReadableStream<Uint8Array>>;
  /** `POST /api/auth/login`: no token. */
  login: (username: string, password: string) => Promise<BackendSession>;
  /** `POST /api/auth/reset-start`: no token. Rejects with an `ApiError`; the auth port turns it into a refusal. */
  resetStart: (username: string) => Promise<string>;
  /** `POST /api/auth/reset`: no token. */
  reset: (username: string, answer: string, newPassword: string) => Promise<void>;
  /** `POST /api/auth/refresh` once on load, carrying only the httpOnly cookie: the session it restores, or null (no
   *  cookie, an ended session, an unreachable backend). Never rejects; a second call shares the first. */
  restore: () => Promise<BackendSession | null>;
  /** `POST /api/auth/logout` (the cookie names the session). Never rejects: the session is gone whatever the answer is. */
  logout: () => Promise<void>;
}

const unauthorized = (): ApiError => new ApiError("auth.unauthorized", ERROR_SENTENCES["auth.unauthorized"] ?? "", 401);
/** A 401 that means the access token is no good. A wrong CURRENT password (`auth.invalid_credentials`) is also a 401, but
 *  the session is fine: it must reach the form, never refresh and never end the session. */
const isUnauthorized = (error: unknown): boolean =>
  error instanceof ApiError && error.status === 401 && error.code !== "auth.invalid_credentials";

export function createSessionApi(deps: SessionApiDeps): SessionApi {
  const common = {
    sentences: ERROR_SENTENCES,
    failureCodes: FAILURE_CODES,
    defaultArea: "Connection" as EventArea,
    fetch: deps.fetch,
  };
  const open = createApi<EventArea>(common);
  const authed = createApi<EventArea>({
    ...common,
    headers: (): Readonly<Record<string, string>> => {
      const tokens = deps.tokens();
      return tokens === null ? {} : { authorization: `Bearer ${tokens.accessToken}` };
    },
  });

  let inflight: Promise<void> | null = null;

  function refreshOnce(): Promise<void> {
    if (inflight !== null) return inflight;
    const tokens = deps.tokens();
    if (tokens === null) return Promise.reject(unauthorized());
    const run = open
      .api("/api/auth/refresh", SessionSchema, { method: "POST" })
      .then((session) => deps.adopt(tokensOf(session)))
      .finally(() => {
        inflight = null;
      });
    inflight = run;
    return run;
  }

  /** Refresh, or end the session when the refresh fails: every waiter shares the one outcome. */
  const settle = (): Promise<void> =>
    refreshOnce().catch((error: unknown) => {
      deps.end(SESSION_ENDED_NOTICE);
      throw error;
    });

  /** Any signed-in call: the proactive refresh, then `call`, then ONE retry of `call` after a refresh on a 401. */
  async function signedIn<T>(call: () => Promise<T>): Promise<T> {
    const first = deps.tokens();
    if (first === null) throw unauthorized();
    if (first.accessExpiresAt - deps.now() < REFRESH_SKEW_MS) await settle();
    const used = deps.tokens()?.accessToken;
    try {
      return await call();
    } catch (error: unknown) {
      if (!isUnauthorized(error)) throw error;
      /* A request that met the same expiry earlier may already have refreshed: then only the retry is owed. */
      if (deps.tokens()?.accessToken === used) await settle();
      else if (deps.tokens() === null) throw error;
    }
    try {
      return await call();
    } catch (error: unknown) {
      if (isUnauthorized(error)) deps.end(SESSION_ENDED_NOTICE);
      throw error;
    }
  }

  const request = <T>(path: string, schema: z.ZodType<T>, options: CallOptions = {}): Promise<T> =>
    signedIn(() => authed.api(path, schema, options));

  /** A streamed body, signed in like any call; `quiet` keeps a successful open out of the Events drawer. */
  const stream = (path: string, options: StreamOptions = {}): Promise<ReadableStream<Uint8Array>> =>
    signedIn(() => authed.apiStream(path, options));

  /** The one on-load probe: the same promise for every caller, so a double mount sends one refresh. */
  let probe: Promise<BackendSession | null> | null = null;

  function restore(): Promise<BackendSession | null> {
    /* A session already in memory owns the refresh token's rotation: probing beside it would present a used token. */
    if (deps.tokens() !== null) return Promise.resolve(null);
    probe ??= open.api("/api/auth/refresh", SessionSchema, { method: "POST" }).catch(() => null);
    return probe;
  }

  return {
    request,
    stream,
    restore,
    login: (username, password) =>
      open.api("/api/auth/login", SessionSchema, { method: "POST", body: { username, password } }),
    resetStart: async (username) => {
      const body = { username };
      return (await open.api("/api/auth/reset-start", ResetStartSchema, { method: "POST", body })).question;
    },
    reset: async (username, answer, newPassword) => {
      const body = { username, answer, newPassword };
      await open.api("/api/auth/reset", ResetDoneSchema, { method: "POST", body });
    },
    logout: async () => {
      const tokens = deps.tokens();
      if (tokens === null) return;
      try {
        await authed.api("/api/auth/logout", AnySchema, { method: "POST" });
      } catch {
        /* auth.refresh_invalid, a transport failure: the session is gone either way (`29` section 6.1). */
      }
    },
  };
}
