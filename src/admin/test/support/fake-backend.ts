import type { FetchLike } from "@giga/http/request-types";
import type { SessionApiDeps } from "@/services/session-api";
import type { SessionTokens } from "@/types/auth";

/* A scripted backend for the request-layer tests: a fetch that answers from a handler and records every call, and a rig that
 * holds the tokens in a variable the way the store does. No network, no store, no clock but the one the test sets. */

export interface Call {
  readonly url: string;
  readonly method: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: unknown;
}

export type Handler = (call: Call) => Response | Promise<Response>;

export const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export const success = (data: unknown, status = 200): Response => json({ ok: true, data }, status);

export const failure = (status: number, code: string, message: string): Response =>
  json({ ok: false, error: { code, message } }, status);

export const ACCOUNT = { id: 7, username: "ada@example.test", name: "Ada", disabled: false, createdAt: 1, updatedAt: 2 };

export const sessionBody = (access: string, refresh: string, expiresAt: number) => ({
  accessToken: access,
  accessExpiresAt: expiresAt,
  refreshToken: refresh,
  refreshExpiresAt: expiresAt + 1000,
  account: ACCOUNT,
});

export function scripted(handler: Handler): { fetch: FetchLike; calls: Call[] } {
  const calls: Call[] = [];
  const fetch: FetchLike = async (input, init) => {
    const headers = Object.fromEntries(Object.entries((init?.headers as Record<string, string> | undefined) ?? {}));
    const body = typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : undefined;
    const call: Call = { url: input, method: init?.method ?? "GET", headers, body };
    calls.push(call);
    return handler(call);
  };
  return { fetch, calls };
}

export interface Rig {
  deps: SessionApiDeps;
  tokens: SessionTokens | null;
  ended: string[];
  clock: { now: number };
}

/** The request layer's dependencies over a variable: tokens in, adopt and end writing back, the clock the test sets. */
export function rig(fetch: FetchLike, start: SessionTokens | null): Rig {
  const state: Rig = {
    tokens: start,
    ended: [],
    clock: { now: 1_000 },
    deps: {
      fetch,
      now: () => state.clock.now,
      tokens: () => state.tokens,
      adopt: (tokens) => {
        state.tokens = tokens;
      },
      end: (sentence) => {
        state.ended.push(sentence);
        state.tokens = null;
      },
    },
  };
  return state;
}

export const TOKENS: SessionTokens = {
  accessToken: "access-1",
  accessExpiresAt: 1_000_000,
  refreshToken: "refresh-1",
  refreshExpiresAt: 2_000_000,
};
