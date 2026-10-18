import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";
import { resetRefusalFor } from "@/lib/auth-errors";
import { createAuthPort } from "@/services/auth-port";
import { createSessionApi } from "@/services/session-api";
import { ApiError } from "@giga/http/api-error";
import { TOKENS, failure, rig, scripted, success, type Handler } from "./support/fake-backend";

const portOver = (handler: Handler, tokens = null as typeof TOKENS | null) => {
  const backend = scripted(handler);
  return { backend, port: createAuthPort(createSessionApi(rig(backend.fetch, tokens).deps)) };
};
const QUESTION = "In what city were you born?";

describe("reset-start", () => {
  it("posts the username with no token and answers the question", async () => {
    const { backend, port } = portOver(() => success({ question: QUESTION }), TOKENS);
    assert.deepEqual(await port.resetStart("ada"), { ok: true, question: QUESTION });
    const call = backend.calls[0];
    assert.deepEqual([call?.url, call?.method, call?.body], ["/api/auth/reset-start", "POST", { username: "ada" }]);
    assert.equal(call?.headers.authorization, undefined, "the token-free layer, even when a session exists");
  });

  it("refuses with unreachable for every failure", async () => {
    const cases: Array<[Handler, string]> = [
      [() => failure(500, "internal.failure", "x"), "unreachable"],
      [() => failure(422, "account.invalid", "x"), "unreachable"],
      [() => Promise.reject(new TypeError("down")), "unreachable"],
      [() => new Response("<html>", { status: 200 }), "unreachable"],
      [() => success({ nope: 1 }), "unreachable"],
    ];
    for (const [handler, refusal] of cases) {
      assert.deepEqual(await portOver(handler).port.resetStart("ada"), { ok: false, refusal }, refusal);
    }
  });
});

describe("reset", () => {
  it("posts the username, the answer and the new password as typed, with no token", async () => {
    const { backend, port } = portOver(() => success({ reset: true }), TOKENS);
    assert.deepEqual(await port.resetPassword("ada", "  Rex ", " new pass "), { ok: true });
    const call = backend.calls[0];
    assert.equal(call?.url, "/api/auth/reset");
    assert.deepEqual(call?.body, { username: "ada", answer: "  Rex ", newPassword: " new pass " });
    assert.equal(call?.headers.authorization, undefined);
  });

  it("maps each refusal: reset_invalid, a 422 as weak, a transport failure", async () => {
    const cases: Array<[Handler, string]> = [
      [() => failure(401, "auth.reset_invalid", "x"), "invalid"],
      [() => failure(422, "account.invalid", "x"), "weak"],
      [() => failure(503, "internal.failure", "x"), "unreachable"],
      [() => Promise.reject(new TypeError("down")), "unreachable"],
    ];
    for (const [handler, refusal] of cases) {
      assert.deepEqual(await portOver(handler).port.resetPassword("a", "b", "c"), { ok: false, refusal }, refusal);
    }
  });

  it("a wrong answer never ends or refreshes a session: it is a plain refusal on the token-free layer", async () => {
    const { backend } = portOver(() => failure(401, "auth.reset_invalid", "x"), TOKENS);
    const state = rig(backend.fetch, TOKENS);
    const api = createSessionApi(state.deps);
    await assert.rejects(api.reset("a", "b", "c"), (error: unknown) => error instanceof ApiError && error.status === 401);
    assert.deepEqual([state.ended, backend.calls.map((c) => c.url)], [[], ["/api/auth/reset"]]);
  });
});

describe("a wrong current password on a signed-in call", () => {
  it("reaches the form as invalid_credentials: no refresh, and the session is not ended", async () => {
    const Done = z.object({ set: z.literal(true) });
    const backend = scripted(() => failure(401, "auth.invalid_credentials", "The username or password is wrong."));
    const state = rig(backend.fetch, TOKENS);
    const api = createSessionApi(state.deps);
    await assert.rejects(
      api.request("/api/auth/me/security-question", Done, { method: "PUT", body: {} }),
      (error: unknown) => error instanceof ApiError && error.code === "auth.invalid_credentials",
    );
    assert.deepEqual([backend.calls.length, state.ended], [1, []]);
  });
});

describe("resetRefusalFor", () => {
  it("is pure over the error", () => {
    assert.equal(resetRefusalFor(new ApiError("auth.reset_invalid", "x", 401)), "invalid");
    assert.equal(resetRefusalFor(new ApiError("account.invalid", "x", 422)), "weak");
    assert.equal(resetRefusalFor(new ApiError("auth.rate_limited", "x", 429)), "unreachable", "a stale code is not special");
    assert.equal(resetRefusalFor(new Error("x")), "unreachable");
  });
});
