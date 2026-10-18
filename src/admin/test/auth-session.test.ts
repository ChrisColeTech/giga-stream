import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { z } from "zod";
import { PASSWORD_CHANGED_NOTICE, SESSION_ENDED_NOTICE } from "@/constants/sign-in-copy";
import { refusalFor } from "@/lib/auth-errors";
import { createAuthPort } from "@/services/auth-port";
import { createSessionApi } from "@/services/session-api";
import { useAppStore } from "@/store/app-store";
import type { AuthSession } from "@/types/auth";
import { ApiError } from "@giga/http/api-error";
import { TOKENS, failure, rig, scripted, sessionBody, success, type Call } from "./support/fake-backend";
import { resetStore } from "./support/store";

const Item = z.object({ n: z.number() });
const isRefresh = (call: Call): boolean => call.url === "/api/auth/refresh";

describe("login", () => {
  it("answers the actor and the tokens, to be held in memory by the store", async () => {
    const backend = scripted(() => success(sessionBody("a1", "r1", 5000)));
    const port = createAuthPort(createSessionApi(rig(backend.fetch, null).deps));
    const result = await port.signIn("ada@example.test", "secret");
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.session.actor, { id: 7, username: "ada@example.test", securityQuestionSet: false });
    assert.deepEqual(result.session.tokens, {
      accessToken: "a1", accessExpiresAt: 5000, refreshToken: "r1", refreshExpiresAt: 6000,
    });
    assert.equal(backend.calls[0]?.url, "/api/auth/login");
  });

  it("refuses with the gate's kinds: invalid, locked, rate_limited and unreachable", async () => {
    const kinds: Array<[() => Response | Promise<Response>, string]> = [
      [() => failure(401, "auth.invalid_credentials", "x"), "invalid"],
      [() => failure(429, "auth.locked", "x"), "locked"],
      [() => failure(429, "auth.rate_limited", "x"), "rate_limited"],
      [() => failure(500, "internal.failure", "x"), "unreachable"],
      [() => Promise.reject(new TypeError("down")), "unreachable"],
      [() => new Response("nope", { status: 200 }), "unreachable"],
    ];
    for (const [answer, kind] of kinds) {
      const port = createAuthPort(createSessionApi(rig(scripted(answer).fetch, null).deps));
      assert.deepEqual(await port.signIn("a@b.test", "x"), { ok: false, refusal: kind }, kind);
    }
  });
});

describe("the refresh", () => {
  it("runs before a call when the access token is about to expire", async () => {
    const backend = scripted((call) => (isRefresh(call) ? success(sessionBody("access-2", "refresh-2", 9_000_000)) : success({ n: 1 })));
    const state = rig(backend.fetch, { ...TOKENS, accessExpiresAt: 1_010 });
    await createSessionApi(state.deps).request("/api/x", Item);
    assert.deepEqual(backend.calls.map((call) => call.url), ["/api/auth/refresh", "/api/x"]);
    assert.equal(backend.calls[0]?.body, undefined, "no body: the httpOnly cookie carries the refresh token");
    assert.equal(backend.calls[1]?.headers.authorization, "Bearer access-2");
    assert.equal(state.tokens?.refreshToken, "refresh-2", "the new session replaces the old whole");
  });

  it("makes exactly ONE refresh for two requests that meet a 401 together, and retries each once", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const backend = scripted(async (call) => {
      if (isRefresh(call)) {
        await gate;
        return success(sessionBody("access-2", "refresh-2", 9_000_000));
      }
      return call.headers.authorization === "Bearer access-2"
        ? success({ n: 2 })
        : failure(401, "auth.unauthorized", "Sign in to do that.");
    });
    const state = rig(backend.fetch, TOKENS);
    const api = createSessionApi(state.deps);
    const pair = Promise.all([api.request("/api/a", Item), api.request("/api/b", Item)]);
    await new Promise((resolve) => setImmediate(resolve));
    release();
    assert.deepEqual(await pair, [{ n: 2 }, { n: 2 }]);
    assert.equal(backend.calls.filter(isRefresh).length, 1, "one refresh");
    for (const path of ["/api/a", "/api/b"]) {
      assert.equal(backend.calls.filter((call) => call.url === path).length, 2, `${path}: the first try and one retry`);
    }
    assert.deepEqual(state.ended, []);
  });

  it("clears the session and shows the gate when the refresh fails, for every waiter", async () => {
    const backend = scripted((call) =>
      isRefresh(call) ? failure(401, "auth.refresh_invalid", "gone") : failure(401, "auth.unauthorized", "Sign in."),
    );
    const state = rig(backend.fetch, TOKENS);
    const api = createSessionApi(state.deps);
    const settled = await Promise.allSettled([api.request("/api/a", Item), api.request("/api/b", Item)]);
    assert.ok(settled.every((item) => item.status === "rejected"));
    assert.equal(backend.calls.filter(isRefresh).length, 1);
    assert.equal(state.tokens, null);
    assert.ok(state.ended.every((sentence) => sentence === SESSION_ENDED_NOTICE) && state.ended.length > 0);
  });

  it("ends the session when the retried call is refused again, and never retries a second time", async () => {
    const backend = scripted((call) =>
      isRefresh(call) ? success(sessionBody("access-2", "refresh-2", 9_000_000)) : failure(401, "auth.unauthorized", "x"),
    );
    const state = rig(backend.fetch, TOKENS);
    await assert.rejects(createSessionApi(state.deps).request("/api/a", Item));
    assert.equal(backend.calls.filter((call) => call.url === "/api/a").length, 2);
    assert.deepEqual(state.ended, [SESSION_ENDED_NOTICE]);
  });

  it("ends the session when the refresh itself cannot reach the backend", async () => {
    const backend = scripted((call) => (isRefresh(call) ? Promise.reject(new TypeError("down")) : failure(401, "auth.unauthorized", "x")));
    const state = rig(backend.fetch, TOKENS);
    await assert.rejects(createSessionApi(state.deps).request("/api/a", Item));
    assert.equal(state.tokens, null);
  });
});

describe("logout", () => {
  it("posts with the bearer and no body: the cookie names the session", async () => {
    const backend = scripted(() => success({}));
    await createSessionApi(rig(backend.fetch, TOKENS).deps).logout();
    assert.deepEqual(backend.calls.map((call) => [call.url, call.body]), [["/api/auth/logout", undefined]]);
    assert.equal(backend.calls[0]?.headers.authorization, "Bearer access-1");
  });

  it("resolves on auth.refresh_invalid, on a dead backend and with no session, so the session is cleared either way", async () => {
    for (const answer of [() => failure(401, "auth.refresh_invalid", "x"), () => Promise.reject(new TypeError("down"))]) {
      await createSessionApi(rig(scripted(answer).fetch, TOKENS).deps).logout();
    }
    const none = scripted(() => success({}));
    await createSessionApi(rig(none.fetch, null).deps).logout();
    assert.equal(none.calls.length, 0);
  });
});

describe("the session in the store", () => {
  const session: AuthSession = { actor: { id: 7, username: "ada@example.test" }, tokens: TOKENS };
  const state = () => useAppStore.getState();
  const signIn = (): void => {
    state().beginSignIn();
    state().finishSignIn({ ok: true, session });
  };

  beforeEach(() => resetStore());

  it("starts signed out, with no tokens in memory: a reload is restored by the probe (restore-session.test.ts)", () => {
    assert.equal(state().signedIn, false);
    assert.equal(state().tokens, null);
  });

  it("holds the tokens in memory after sign-in and swaps them whole on a refresh", () => {
    signIn();
    assert.equal(state().signedIn, true);
    assert.deepEqual(state().tokens, TOKENS);
    state().adoptTokens({ ...TOKENS, accessToken: "access-2", refreshToken: "refresh-2" });
    assert.equal(state().tokens?.refreshToken, "refresh-2");
  });

  it("ignores a refresh that lands after sign-out", () => {
    signIn();
    state().signOut();
    state().adoptTokens(TOKENS);
    assert.equal(state().tokens, null);
  });

  it("returns to the gate with the sentence when the session ends, and forgets the tokens and the account", () => {
    signIn();
    state().endSession(SESSION_ENDED_NOTICE);
    assert.deepEqual([state().signedIn, state().tokens, state().actor], [false, null, null]);
    assert.deepEqual(state().gate, { phase: "idle", notice: SESSION_ENDED_NOTICE });
  });

  it("signs out after the account's own password changes, with that notice on the gate", () => {
    signIn();
    state().endSession(PASSWORD_CHANGED_NOTICE);
    assert.equal(state().signedIn, false);
    assert.deepEqual(state().gate, { phase: "idle", notice: "Password changed. Sign in again." });
  });

  it("signs out with nothing said and no tokens", () => {
    signIn();
    state().signOut();
    assert.deepEqual([state().tokens, state().gate], [null, { phase: "idle", notice: null }]);
  });
});

describe("the refusal mapping", () => {
  it("maps the backend's codes to the gate's kinds", () => {
    const table: Array<[string, number | undefined, string]> = [
      ["auth.invalid_credentials", 401, "invalid"],
      ["auth.locked", 429, "locked"],
      ["auth.rate_limited", 429, "rate_limited"],
      ["backend.unreachable", undefined, "unreachable"],
      ["backend.bad_response", 200, "unreachable"],
      ["backend.not_connected", undefined, "unreachable"],
      ["internal.failure", 500, "unreachable"],
      ["request.invalid", 400, "invalid"],
    ];
    for (const [code, status, kind] of table) assert.equal(refusalFor(new ApiError(code, "x", status)), kind, code);
    assert.equal(refusalFor(new Error("boom")), "unreachable");
  });
});
