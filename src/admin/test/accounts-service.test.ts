import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { ApiError } from "@giga/http/api-error";
import { createBody } from "@/lib/account-body";
import { accounts } from "@/services/accounts";
import { json, success } from "./support/fake-backend";
import { withBackend } from "./support/global-fetch";
import { resetStore, signInForTest } from "./support/store";

const row = (id: string, username: string) => ({ id, username, disabled: false, createdAt: 1, updatedAt: 2 });
const refusal = (status: number, code: string, field?: string) =>
  json({ ok: false, error: { code, message: "Server sentence.", ...(field && { details: { field } }) } }, status);

beforeEach(() => {
  resetStore();
  signInForTest();
});

describe("the accounts service", () => {
  it("lists /api/admin-accounts, dropping and counting a row it cannot read", async () => {
    await withBackend(
      () => success({ items: [row("a", "a@x.test"), { id: "broken" }, row("b", "b@x.test")] }),
      async (calls) => {
        const list = await accounts.list();
        assert.equal(calls[0]?.url, "/api/admin-accounts");
        assert.deepEqual([list.items.map((item) => item.id), list.unreadable], [["a", "b"], 1]);
      },
    );
  });

  it("posts the trimmed username and the password untouched", async () => {
    await withBackend(
      () => success(row("n", "new@x.test"), 201),
      async (calls) => {
        await accounts.create(createBody({ username: " new@x.test ", password: "  pass word 12  " }));
        assert.equal(calls[0]?.method, "POST");
        assert.deepEqual(calls[0]?.body, { username: "new@x.test", password: "  pass word 12  " });
      },
    );
  });

  it("patches only the fields it is given, and deletes by id", async () => {
    await withBackend(
      (call) => success(call.method === "DELETE" ? { id: "a b" } : row("a b", "a@x.test")),
      async (calls) => {
        await accounts.update("a b", { disabled: true });
        await accounts.remove("a b");
        assert.deepEqual([calls[0]?.method, calls[0]?.url, calls[0]?.body], ["PATCH", "/api/admin-accounts/a%20b", { disabled: true }]);
        assert.deepEqual([calls[1]?.method, calls[1]?.url], ["DELETE", "/api/admin-accounts/a%20b"]);
      },
    );
  });

  it("answers backend.bad_response when a write answer cannot be read", async () => {
    await withBackend(
      () => success({ nope: 1 }),
      async () => {
        await assert.rejects(accounts.create({ username: "a@x.test", password: "x".repeat(12) }), { code: "backend.bad_response" });
      },
    );
  });

  it("puts the question save to the account's own route, reading its `{ set: true }` answer", async () => {
    await withBackend(
      () => success({ set: true }),
      async (calls) => {
        const saved = await accounts.saveQuestion("a b", { question: 3, answer: " Rex " });
        assert.deepEqual([saved, calls[0]?.method, calls[0]?.url, calls[0]?.body], [
          { set: true },
          "PUT",
          "/api/admin-accounts/a%20b/security-question",
          { question: 3, answer: " Rex " },
        ]);
      },
    );
    await withBackend(
      () => success({ nope: 1 }),
      async () => {
        await assert.rejects(accounts.saveQuestion("a", { question: 1, answer: "x" }), { code: "backend.bad_response" });
      },
    );
  });

  it("carries the field of a 409 and a 422 refusal", async () => {
    await withBackend(
      (call) => (call.method === "POST" ? refusal(409, "account.username_taken", "username") : refusal(422, "account.invalid", "password")),
      async () => {
        await assert.rejects(accounts.create({}), (error: unknown) => {
          assert.ok(error instanceof ApiError);
          assert.deepEqual([error.code, error.status, error.field, error.message], ["account.username_taken", 409, "username", "Server sentence."]);
          return true;
        });
        await assert.rejects(accounts.update("a", { password: "short" }), { code: "account.invalid", status: 422, field: "password" });
      },
    );
  });
});
