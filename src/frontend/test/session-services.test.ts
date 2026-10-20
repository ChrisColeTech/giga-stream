import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { refusalFor, resetRefusalFor } from "@/lib/auth-errors";
import { ApiError } from "@/services/api";
import { createSessionApi } from "@/services/session-api";
import { useAppStore } from "@/store/app-store";

const SESSION = {
  accessToken: "token-1",
  accessExpiresAt: 1,
  refreshToken: "refresh-1",
  refreshExpiresAt: 2,
  account: { id: "acc-1", username: "ivy", kind: "user" as const },
};

const originalFetch = globalThis.fetch;

const success = (data: unknown) => new Response(JSON.stringify({ ok: true, data }), { status: 200 });
const refused = (code: string, status: number) =>
  new Response(JSON.stringify({ ok: false, error: { code, message: "No." } }), { status });

interface Call {
  readonly input: string;
  readonly method?: string;
  readonly body?: string;
}

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("the session transport (`62` section 3.2)", () => {
  it("login posts the pair to the app's auth route and answers the session", async () => {
    const calls: Call[] = [];
    globalThis.fetch = async (input, init) => {
      calls.push({ input: String(input), method: init?.method, body: String(init?.body) });
      return success(SESSION);
    };
    const session = await createSessionApi().login("ivy", "horse battery");
    assert.deepEqual(session, SESSION);
    assert.deepEqual(calls, [
      {
        input: "/api/account/auth/login",
        method: "POST",
        body: JSON.stringify({ username: "ivy", password: "horse battery" }),
      },
    ]);
  });

  it("restore probes the cookie route once per instance, shares the answer, and a refusal is null", async () => {
    const calls: Call[] = [];
    globalThis.fetch = async (input, init) => {
      calls.push({ input: String(input), method: init?.method });
      return refused("auth.refresh_invalid", 401);
    };
    const transport = createSessionApi();
    const first = await transport.restore();
    const second = await transport.restore();
    assert.equal(first, null);
    assert.equal(second, null);
    assert.deepEqual(calls, [{ input: "/api/account/auth/restore", method: "POST" }]);
  });

  it("sign-out presents the refresh token the store holds, and never rejects on a refusal", async () => {
    const calls: Call[] = [];
    globalThis.fetch = async (input, init) => {
      calls.push({ input: String(input), method: init?.method, body: String(init?.body) });
      return refused("auth.refresh_invalid", 401);
    };
    useAppStore.setState({
      signedIn: true,
      tokens: { accessToken: "token-1", accessExpiresAt: 1, refreshToken: "refresh-1", refreshExpiresAt: 2 },
    });
    await createSessionApi().signOut();
    assert.deepEqual(calls, [
      {
        input: "/api/account/auth/logout",
        method: "POST",
        body: JSON.stringify({ refreshToken: "refresh-1" }),
      },
    ]);
  });

  it("sign-out sends nothing when the store holds no tokens", async () => {
    const calls: Call[] = [];
    globalThis.fetch = async (input, init) => {
      calls.push({ input: String(input), method: init?.method });
      return success({ signedOut: true });
    };
    await createSessionApi().signOut();
    assert.deepEqual(calls, []);
  });

  it("the reset is the console's sequence at the landed auth-security prefix, username-keyed", async () => {
    const calls: Call[] = [];
    globalThis.fetch = async (input, init) => {
      calls.push({ input: String(input), method: init?.method, body: String(init?.body) });
      return calls.length === 1 ? success({ question: "What was your first pet?" }) : success({ reset: true });
    };
    const transport = createSessionApi();
    const question = await transport.resetStart("ivy");
    await transport.resetPassword("ivy", " a hamster ", "newer password");
    assert.equal(question, "What was your first pet?");
    assert.deepEqual(calls, [
      {
        input: "/api/admin/auth-security/reset-start",
        method: "POST",
        body: JSON.stringify({ username: "ivy" }),
      },
      {
        input: "/api/admin/auth-security/reset",
        method: "POST",
        body: JSON.stringify({ username: "ivy", answer: " a hamster ", newPassword: "newer password" }),
      },
    ]);
  });
});

describe("the gate's refusal mapping (`lib/auth-errors`)", () => {
  it("a wrong pair and a dead session are invalid; the transport's own failures are unreachable", () => {
    assert.equal(refusalFor(new ApiError("auth.invalid_credentials", "No.", 401)), "invalid");
    assert.equal(refusalFor(new ApiError("route.not_found", "No.", 404)), "invalid");
    assert.equal(refusalFor(new ApiError("fileserver.unreachable", "No.")), "unreachable");
    assert.equal(refusalFor(new ApiError("response.invalid", "No.", 500)), "unreachable");
    assert.equal(refusalFor(new ApiError("internal.failure", "No.", 500)), "unreachable");
    assert.equal(refusalFor(new Error("no answer")), "unreachable");
  });

  it("the reset's own codes map to their fields' refusals", () => {
    assert.equal(resetRefusalFor(new ApiError("auth.reset_invalid", "No.", 401)), "invalid");
    assert.equal(resetRefusalFor(new ApiError("account.invalid", "No.", 422)), "weak");
    assert.equal(resetRefusalFor(new ApiError("fileserver.unreachable", "No.")), "unreachable");
    assert.equal(resetRefusalFor(new ApiError("internal.failure", "No.", 500)), "unreachable");
    assert.equal(resetRefusalFor(new Error("no answer")), "unreachable");
  });
});
