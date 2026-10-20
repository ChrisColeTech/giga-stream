import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { z } from "zod";
import { SESSION_ENDED_NOTICE } from "@/constants/gate-copy";
import { gateError, gateNotice } from "@/lib/gate-state";
import { api } from "@/services/api";
import type { AuthSession } from "@/types/auth";
import { useAppStore } from "@/store/app-store";

const state = () => useAppStore.getState();

const SESSION: AuthSession = {
  actor: { id: "acc-1", username: "ivy", kind: "user" },
  tokens: { accessToken: "token-1", accessExpiresAt: 1, refreshToken: "refresh-1", refreshExpiresAt: 2 },
};

const originalFetch = globalThis.fetch;

/** A 401 with the standard error envelope, the shape an ended session is answered with. */
const unauthorized = () =>
  new Response(JSON.stringify({ ok: false, error: { code: "auth.unauthorized", message: "Sign in to do that." } }), {
    status: 401,
  });

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  Reflect.deleteProperty(globalThis, "window");
});

describe("the gate (`62` section 3.5)", () => {
  it("holds the window on the wall while the boot's restore waits, and a refused restore keeps it there", () => {
    assert.equal(state().restoring, true);
    state().finishRestore(null);
    assert.equal(state().restoring, false);
    assert.equal(state().signedIn, false);
    assert.equal(state().session, null);
  });

  it("a restored session enters the app with the account and the tokens", () => {
    state().finishRestore(SESSION);
    assert.equal(state().restoring, false);
    assert.equal(state().signedIn, true);
    assert.deepEqual(state().session, SESSION.actor);
    assert.deepEqual(state().tokens, SESSION.tokens);
  });

  it("only the first restore answer counts: a late probe changes nothing", () => {
    state().finishRestore(null);
    assert.equal(state().signedIn, false);
    /* The person then signed in through the gate: the verb marks the gate submitting before the port answers. */
    state().beginSignIn();
    state().finishSignIn({ ok: true, session: SESSION });
    assert.equal(state().signedIn, true);
    /* The boot's probe lands late, carrying a session: the first answer already counted, so this changes nothing. */
    state().finishRestore(SESSION);
    assert.equal(state().signedIn, true);
    assert.deepEqual(state().session, SESSION.actor);
    assert.deepEqual(state().tokens, SESSION.tokens);
  });

  it("signing in enters the app; a second submit while one waits is ignored", () => {
    state().beginSignIn();
    assert.equal(state().gate.phase, "submitting");
    state().beginSignIn();
    assert.equal(state().gate.phase, "submitting");
    state().finishSignIn({ ok: true, session: SESSION });
    assert.equal(state().signedIn, true);
    assert.equal(state().gate.phase, "idle");
  });

  it("a wrong pair is refused with its sentence; an unreachable backend leaves the verb enabled for the retry", () => {
    state().beginSignIn();
    state().finishSignIn({ ok: false, refusal: "invalid" });
    assert.equal(state().gate.phase, "refused");
    assert.equal(gateError(state().gate), "The username or password is wrong.");
    assert.equal(state().signedIn, false);
    state().beginSignIn();
    state().finishSignIn({ ok: false, refusal: "unreachable" });
    assert.equal(state().gate.phase, "unreachable");
    assert.equal(gateError(state().gate), "The account backend cannot be reached.");
  });

  it("an answer when nothing is waiting (a sign-out raced it) changes nothing", () => {
    state().finishSignIn({ ok: false, refusal: "invalid" });
    assert.equal(state().gate.phase, "idle");
  });

  it("sign-out returns to the gate and keeps the device's state", () => {
    state().finishSignIn({ ok: true, session: SESSION });
    state().setSurface("player");
    state().signOut();
    assert.equal(state().signedIn, false);
    assert.equal(state().session, null);
    assert.equal(state().tokens, null);
    assert.equal(state().gate.phase, "idle");
    assert.equal(gateNotice(state().gate), null);
    assert.equal(state().surface, "player");
  });

  it("ends a live session on a 401 and says so, signed out", async () => {
    state().beginSignIn();
    state().finishSignIn({ ok: true, session: SESSION });
    const calls: Array<{ input: string; headers: Record<string, string> }> = [];
    globalThis.fetch = async (input, init) => {
      calls.push({ input: String(input), headers: (init?.headers ?? {}) as Record<string, string> });
      return unauthorized();
    };
    await assert.rejects(api("/api/account/settings", z.unknown()));
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.headers.authorization, "Bearer token-1");
    assert.equal(state().signedIn, false);
    assert.equal(state().tokens, null);
    assert.equal(state().gate.phase, "idle");
    assert.equal(gateNotice(state().gate), SESSION_ENDED_NOTICE);
  });

  it("a 401 while signed out (a wrong password, a refused restore) ends nothing and says nothing", async () => {
    globalThis.fetch = async () => unauthorized();
    await assert.rejects(api("/api/account/settings", z.unknown()));
    assert.equal(state().signedIn, false);
    assert.equal(state().gate.phase, "idle");
  });

  it("the desktop offline escape has left (`63` section 3.1): signed out, the app keeps running", () => {
    assert.equal("continueOffline" in state(), false);
    assert.equal("offline" in state(), false);
    assert.equal(state().signedIn, false);
    assert.equal(state().restoring, true);
  });
});
