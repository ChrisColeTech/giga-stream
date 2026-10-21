import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { SECURITY_QUESTIONS } from "@/constants/security-questions";
import { nextProfile, PROFILE_START } from "@/lib/profile-state";
import { nextRegistration, REGISTRATION_START } from "@/lib/registration-state";
import { registrationError } from "@/lib/registration-verb";
import { createSessionApi } from "@/services/session-api";
import { useAppStore } from "@/store/app-store";
import type { AuthSession, RegistrationInput } from "@/types/auth";

const WIRE_SESSION = {
  accessToken: "access-1",
  accessExpiresAt: 10,
  refreshToken: "refresh-1",
  refreshExpiresAt: 20,
  account: { id: "acct-1", username: "ivy", kind: "user" as const, securityQuestionSet: true },
};
const SESSION: AuthSession = {
  actor: { id: "acct-1", username: "ivy", kind: "user" },
  tokens: { accessToken: "access-1", accessExpiresAt: 10, refreshToken: "refresh-1", refreshExpiresAt: 20 },
};
const INPUT: RegistrationInput = {
  username: "ivy",
  password: "horse battery",
  securityQuestion: 1,
  securityAnswer: "Rex",
};
const originalFetch = globalThis.fetch;
const success = (data: unknown) => new Response(JSON.stringify({ ok: true, data }), { status: 200 });

beforeEach(() => useAppStore.setState(useAppStore.getInitialState(), true));
afterEach(() => { globalThis.fetch = originalFetch; });

describe("registration transport and choices (`65` wave 2)", () => {
  it("posts the strict signup body and parses the returned session", async () => {
    const calls: Array<{ path: string; method?: string; body?: string }> = [];
    globalThis.fetch = async (input, init) => {
      calls.push({ path: String(input), method: init?.method, body: String(init?.body) });
      return success(WIRE_SESSION);
    };
    assert.deepEqual(await createSessionApi().register({ ...INPUT, securityQuestion: 1 }), WIRE_SESSION);
    assert.deepEqual(calls, [{
      path: "/api/account/auth/register",
      method: "POST",
      body: JSON.stringify(INPUT),
    }]);
  });

  it("keeps the fileserver's fixed question labels on wire values 1 through 8", () => {
    assert.deepEqual(SECURITY_QUESTIONS.map((choice) => choice.value), [1, 2, 3, 4, 5, 6, 7, 8]);
    assert.equal(SECURITY_QUESTIONS[0]?.label, "What was the name of your first pet?");
    assert.equal(SECURITY_QUESTIONS[7]?.label, "What is your favourite book?");
  });

  it("validates each registration field before transport", () => {
    assert.equal(registrationError({ ...INPUT, username: "  " })?.field, "username");
    assert.equal(registrationError({ ...INPUT, password: "" })?.field, "password");
    assert.equal(registrationError({ ...INPUT, securityQuestion: 9 })?.field, "securityQuestion");
    assert.equal(registrationError({ ...INPUT, securityAnswer: " " })?.field, "securityAnswer");
    assert.equal(registrationError(INPUT), null);
  });
});

describe("registration and profile request identity", () => {
  it("ignores a double submit and a stale registration answer", () => {
    const busy = nextRegistration(REGISTRATION_START, { type: "submit", requestId: 1 });
    assert.equal(nextRegistration(busy, { type: "submit", requestId: 2 }), busy);
    assert.equal(
      nextRegistration(busy, { type: "answered", requestId: 2, result: { ok: true, session: SESSION } }),
      busy,
    );
    const reset = nextRegistration(busy, { type: "reset" });
    assert.equal(
      nextRegistration(reset, { type: "answered", requestId: 1, result: { ok: true, session: SESSION } }),
      reset,
    );
  });

  it("ignores a stale profile answer", () => {
    const busy = nextProfile(PROFILE_START, { type: "submit", requestId: 4 });
    assert.equal(
      nextProfile(busy, { type: "answered", requestId: 3, result: { ok: true, actor: SESSION.actor } }),
      busy,
    );
  });
});

describe("profile update", () => {
  it("patches /api/account/me and updates only the current session actor", async () => {
    globalThis.fetch = async (input, init) => {
      assert.equal(String(input), "/api/account/me");
      assert.equal(init?.method, "PATCH");
      assert.equal(String(init?.body), JSON.stringify({ username: "new ivy" }));
      return success({ ...WIRE_SESSION.account, username: "new ivy", disabled: false, createdAt: 1, updatedAt: 2 });
    };
    useAppStore.getState().adoptSession(SESSION);
    const account = await createSessionApi().updateUsername("new ivy");
    useAppStore.getState().updateSessionActor({
      id: account.id,
      username: account.username,
      kind: account.kind ?? "admin",
    });
    assert.equal(useAppStore.getState().session?.username, "new ivy");
    assert.deepEqual(useAppStore.getState().tokens, SESSION.tokens);
  });
});
