import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiError } from "@giga/http/api-error";
import { z } from "zod";
import { ERROR_SENTENCES, NOT_CONNECTED_CODE } from "@/constants/api-sentences";
import { AccountListSchema } from "@/services/schemas/account-schema";
import { createSessionApi } from "@/services/session-api";
import { ACCOUNT, TOKENS, failure, json, rig, scripted, success } from "./support/fake-backend";

const Item = z.object({ n: z.number() });

async function refusal(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error: unknown) {
    assert.ok(error instanceof ApiError, "an ApiError");
    return error;
  }
  throw new Error("expected a refusal");
}

describe("the envelope", () => {
  it("parses a success and validates its data with the route's schema", async () => {
    const backend = scripted(() => success({ items: [ACCOUNT] }));
    const api = createSessionApi(rig(backend.fetch, TOKENS).deps);
    const list = await api.request("/api/admin-accounts", AccountListSchema);
    assert.equal(list.items[0]?.username, "ada@example.test");
  });

  it("turns a failure envelope into a typed ApiError with its code, status and the backend's sentence", async () => {
    const backend = scripted(() => failure(409, "account.username_taken", "That username is in use."));
    const api = createSessionApi(rig(backend.fetch, TOKENS).deps);
    const error = await refusal(api.request("/api/admin-accounts", Item, { method: "POST", body: {} }));
    assert.deepEqual([error.code, error.status, error.message], ["account.username_taken", 409, "That username is in use."]);
  });

  it("answers a body that is not an envelope as backend.bad_response", async () => {
    for (const body of [json({ hello: 1 }), new Response("<html>", { status: 200 }), json([1, 2])]) {
      const api = createSessionApi(rig(scripted(() => body.clone()).fetch, TOKENS).deps);
      const error = await refusal(api.request("/api/x", Item));
      assert.equal(error.code, "backend.bad_response");
      assert.equal(error.message, ERROR_SENTENCES["backend.bad_response"]);
    }
  });

  it("answers data that does not match the schema as backend.bad_response", async () => {
    const api = createSessionApi(rig(scripted(() => success({ n: "x" })).fetch, TOKENS).deps);
    assert.equal((await refusal(api.request("/api/x", Item))).code, "backend.bad_response");
  });

  it("answers a fetch that rejects as backend.unreachable", async () => {
    const api = createSessionApi(
      rig(() => Promise.reject(new TypeError("failed to fetch")), TOKENS).deps,
    );
    const error = await refusal(api.request("/api/x", Item));
    assert.equal(error.code, "backend.unreachable");
    assert.equal(error.message, "The admin backend cannot be reached.");
  });
});

describe("the bearer", () => {
  it("sends the current access token on a signed-in call, and a JSON body with its content type", async () => {
    const backend = scripted(() => success({ n: 1 }));
    const api = createSessionApi(rig(backend.fetch, TOKENS).deps);
    await api.request("/api/x", Item, { method: "POST", body: { a: 1 } });
    const call = backend.calls[0];
    assert.equal(call?.headers.authorization, "Bearer access-1");
    assert.equal(call?.headers["content-type"], "application/json");
    assert.deepEqual(call?.body, { a: 1 });
    assert.equal(call?.method, "POST");
    assert.equal(call?.url, "/api/x");
  });

  it("sends nothing and refuses with auth.unauthorized when there is no session", async () => {
    const backend = scripted(() => success({ n: 1 }));
    const api = createSessionApi(rig(backend.fetch, null).deps);
    const error = await refusal(api.request("/api/x", Item));
    assert.deepEqual([error.code, error.status], ["auth.unauthorized", 401]);
    assert.equal(backend.calls.length, 0);
  });

  it("sends no bearer on login", async () => {
    const backend = scripted(() => failure(401, "auth.invalid_credentials", "The username or password is wrong."));
    const api = createSessionApi(rig(backend.fetch, null).deps);
    await refusal(api.login("a@b.test", "x"));
    assert.equal(backend.calls[0]?.headers.authorization, undefined);
    assert.deepEqual(backend.calls[0]?.body, { username: "a@b.test", password: "x" });
  });

  it("only ever sends paths under /api/", async () => {
    const api = createSessionApi(rig(scripted(() => success({ n: 1 })).fetch, TOKENS).deps);
    await assert.rejects(api.request("/healthz", Item), /begin \/api\//);
  });
});

describe("the sentences", () => {
  const DOCUMENTED = [
    "auth.unauthorized", "auth.invalid_credentials", "auth.refresh_invalid",
    "auth.reset_invalid", "account.not_found", "account.invalid", "account.username_taken", "account.last_admin", "account_state.invalid",
    "channel.not_found", "channel.invalid", "channel.taken","path.invalid", "media.not_found",
    "range.unsatisfiable", "provider.not_found", "provider.invalid", "title.not_found", "title.invalid",
    "title.manual", "tmdb.unavailable", "playlist.not_found", "playlist.invalid", "playlist.unreachable",
    "playlist.busy", "playlist.unavailable", "job.not_found", "job.invalid", "job.disabled", "sync.busy",
    "sync.invalid", "request.invalid", "route.not_found", "internal.failure", "store.newer_schema",
    "store.migrate", "store.failed", "backend.unreachable", "backend.bad_response", NOT_CONNECTED_CODE,
  ];

  it("has a plain sentence for every code of 29 section 7", () => {
    for (const code of DOCUMENTED) {
      const sentence = ERROR_SENTENCES[code];
      assert.ok(sentence !== undefined && sentence.trim().length > 0 && sentence.endsWith("."), code);
    }
  });

  it("shows the table's sentence when the backend sends none of its own", async () => {
    const api = createSessionApi(rig(scripted(() => json({ ok: false, error: { code: "account.last_admin", message: " " } }, 409)).fetch, TOKENS).deps);
    const error = await refusal(api.request("/api/x", Item));
    assert.equal(error.message, ERROR_SENTENCES["account.last_admin"]);
  });
});
