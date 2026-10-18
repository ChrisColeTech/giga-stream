import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { ApiError } from "@giga/http/api-error";
import { createAccountFlows, type AccountFlows } from "@/services/account-flows";
import type { AccountsService } from "@/services/accounts";
import { useAppStore } from "@/store/app-store";
import type { AdminAccount } from "@/types/admin-account";
import { resetStore, signInForTest } from "./support/store";

const PASSWORD = "correct horse battery";
const ME = { id: 7, email: "ada@example.test", name: "Ada", disabled: false, createdAt: 1, updatedAt: 1 };
const account = (id: string, disabled = false): AdminAccount => ({ ...ME, id, email: `${id}@x.test`, name: id, disabled });
const state = () => useAppStore.getState();
const refuse = (code: string, status: number, field?: string) =>
  new ApiError(code, `sentence for ${code}`, status, field === undefined ? {} : { field });

type Script = Partial<{ [K in keyof AccountsService]: AccountsService[K] }>;

function rig(script: Script = {}) {
  const calls: string[] = [];
  const reloads: Array<number | undefined> = [];
  const service: AccountsService = {
    list: async () => (calls.push("list"), { items: [ME, account("a"), account("b")], unreadable: 0 }),
    create: async (input) => (calls.push("create"), { ...account("n"), email: String(input["email"]) }),
    /* The real backend never echoes a password; neither does this fake. */
    update: async (id, patch) => (calls.push(`update:${String(id)}`), { ...account(String(id)), disabled: patch["disabled"] === true }),
    remove: async (id) => (calls.push(`remove:${String(id)}`), { id }),
    ...script,
  };
  const flows: AccountFlows = createAccountFlows({
    service,
    store: () => useAppStore.getState(),
    audit: { reload: async (limit) => void reloads.push(limit) },
  });
  return { flows, calls, reloads };
}
const loaded = (): void => state().accountsLoaded([ME, account("a"), account("b", true)]);
const notice = (): string => state().notice?.sentence ?? "";

beforeEach(() => {
  resetStore();
  signInForTest();
});

describe("create", () => {
  it("upserts, says Created, reloads the audit tail with limit 10 and returns ok", async () => {
    const { flows, reloads } = rig();
    const result = await flows.create({ name: "New", email: "new@x.test", password: PASSWORD });
    assert.equal(result.ok, true);
    assert.ok(state().accounts.items.some((item) => item.email === "new@x.test"));
    assert.equal(notice(), "Created new@x.test.");
    assert.deepEqual(reloads, [10]);
  });

  it("refuses a bad value under its row before sending anything", async () => {
    const { flows, calls } = rig();
    const result = await flows.create({ name: "New", email: "nope", password: PASSWORD });
    assert.deepEqual(result, { ok: false, field: "email", sentence: "Email must look like name@example.com." });
    assert.deepEqual(calls, []);
  });

  it("puts email_taken under Email and keeps the notice a warning", async () => {
    const { flows } = rig({ create: async () => Promise.reject(refuse("account.email_taken", 409, "email")) });
    const result = await flows.create({ name: "N", email: "a@x.test", password: PASSWORD });
    assert.deepEqual([result.ok, !result.ok && result.field], [false, "email"]);
    assert.equal(state().notice?.tone, "warn");
  });

  it("marks the backend unreachable on a transport failure, and reads the list again on an unreadable answer", async () => {
    const down = rig({ create: async () => Promise.reject(new ApiError("backend.unreachable", "The admin backend cannot be reached.")) });
    await down.flows.create({ name: "N", email: "a@x.test", password: PASSWORD });
    assert.equal(state().accounts.unreachable, true);
    const bad = rig({ create: async () => Promise.reject(new ApiError("backend.bad_response", "Unreadable.", 201)) });
    await bad.flows.create({ name: "N", email: "a@x.test", password: PASSWORD });
    assert.ok(bad.calls.includes("list"));
  });
});

describe("save", () => {
  it("updates the signed-in actor when the account saved is its own, comparing ids", async () => {
    loaded();
    const { flows } = rig({ update: async (_id, patch) => ({ ...ME, ...patch, email: "ada@new.test" }) });
    const result = await flows.save(7, { name: "Ada", email: "ada@new.test", enabled: true });
    assert.equal(result.ok, true);
    assert.deepEqual(state().actor, { id: 7, email: "ada@new.test", name: "Ada" });
    assert.equal(notice(), "Saved ada@new.test.");
    assert.equal(state().signedIn, true);
  });

  it("ends the session with the disabled notice when the account disables itself", async () => {
    loaded();
    const { flows } = rig();
    await flows.save(7, { name: "Ada", email: ME.email, enabled: false });
    assert.equal(state().signedIn, false);
    assert.deepEqual(state().gate, { phase: "idle", notice: "Your account was disabled." });
  });

  it("says another account is signed out everywhere when it is disabled", async () => {
    loaded();
    const { flows, reloads } = rig();
    await flows.save("a", { name: "a", email: "a@x.test", enabled: false });
    assert.equal(notice(), "Saved a@x.test; it is signed out everywhere.");
    assert.deepEqual(reloads, [10]);
  });

  it("sends nothing when nothing changed", async () => {
    loaded();
    const { flows, calls } = rig();
    const result = await flows.save("a", { name: "a", email: "a@x.test", enabled: true });
    assert.deepEqual([result.ok, calls], [true, []]);
  });

  it("puts last_admin under Enabled, and closes the workspace of an account that is gone", async () => {
    loaded();
    const last = rig({ update: async () => Promise.reject(refuse("account.last_admin", 409)) });
    const result = await last.flows.save("a", { name: "a", email: "a@x.test", enabled: false });
    assert.deepEqual([result.ok, !result.ok && result.field], [false, "enabled"]);
    state().openWorkspace("accounts", "a");
    const gone = rig({ update: async () => Promise.reject(refuse("account.not_found", 404)) });
    await gone.flows.save("a", { name: "a", email: "a@x.test", enabled: false });
    assert.equal(state().workspaces.accounts, null);
    assert.ok(gone.calls.includes("list"), "the list is read again");
  });
});

describe("set password", () => {
  it("tells the other account's password is set, and never shows the password anywhere", async () => {
    loaded();
    const { flows } = rig();
    const result = await flows.setPassword("a", PASSWORD);
    assert.equal(result.ok, true);
    assert.equal(notice(), "Password set; a@x.test is signed out everywhere.");
    const everything = JSON.stringify([state().notice, state().events, state().accounts, state().gate]);
    assert.ok(!everything.includes(PASSWORD));
  });

  it("ends the session with the gate's notice for its own account", async () => {
    loaded();
    const { flows } = rig();
    await flows.setPassword(7, PASSWORD);
    assert.equal(state().signedIn, false);
    assert.deepEqual(state().gate, { phase: "idle", notice: "Password changed. Sign in again." });
  });

  it("refuses a too-long password under the field and a server refusal under it too", async () => {
    loaded();
    const { flows, calls } = rig({ update: async () => Promise.reject(refuse("account.invalid", 422, "password")) });
    const short = await flows.setPassword("a", "x".repeat(257));
    assert.deepEqual([short.ok, !short.ok && short.field], [false, "password"]);
    assert.deepEqual(calls, []);
    const refused = await flows.setPassword("a", PASSWORD);
    assert.deepEqual([refused.ok, !refused.ok && refused.field], [false, "password"]);
    assert.ok(!JSON.stringify([state().notice, state().events]).includes(PASSWORD));
  });
});

describe("remove", () => {
  it("removes another account and says so", async () => {
    loaded();
    const { flows, reloads } = rig();
    await flows.remove("a");
    assert.ok(!state().accounts.items.some((item) => item.id === "a"));
    assert.equal(notice(), "Deleted a@x.test.");
    assert.deepEqual(reloads, [10]);
  });

  it("ends the session when the account deletes itself", async () => {
    loaded();
    await rig().flows.remove(7);
    assert.deepEqual(state().gate, { phase: "idle", notice: "Your account was deleted." });
  });

  it("keeps the row on last_admin and reads the list again; drops it on not_found", async () => {
    loaded();
    const last = rig({ remove: async () => Promise.reject(refuse("account.last_admin", 409)) });
    await last.flows.remove("a");
    assert.ok(state().accounts.items.some((item) => item.id === "a"));
    assert.equal(notice(), "sentence for account.last_admin");
    assert.ok(last.calls.includes("list"));
    const gone = rig({
      remove: async () => Promise.reject(refuse("account.not_found", 404)),
      list: async () => ({ items: [ME, account("a")], unreadable: 0 }),
    });
    await gone.flows.remove("b");
    assert.ok(!state().accounts.items.some((item) => item.id === "b"));
  });
});

describe("load and refresh", () => {
  it("loads, says one notice for unreadable rows, and keeps the last items on a failure", async () => {
    const { flows } = rig({ list: async () => ({ items: [ME], unreadable: 2 }) });
    await flows.load();
    assert.equal(state().accounts.status, "ready");
    assert.equal(notice(), "2 accounts could not be read.");
    const down = rig({ list: async () => Promise.reject(new ApiError("backend.unreachable", "The admin backend cannot be reached.")) });
    await down.flows.load();
    assert.deepEqual([state().accounts.status, state().accounts.items.length, state().accounts.unreachable], ["failed", 1, true]);
  });

  it("starts no second read while one is running, and refresh reads the list and the audit together", async () => {
    const { flows, calls, reloads } = rig();
    state().accountsStartLoad();
    await flows.load();
    assert.deepEqual(calls, []);
    state().accountsLoaded([]);
    await flows.refresh();
    assert.deepEqual([calls, reloads], [["list"], [50]]);
  });
});

describe("a late answer", () => {
  it("is dropped when the session changed while the call was out", async () => {
    let release: () => void = () => undefined;
    const slow = rig({
      create: () =>
        new Promise((resolve) => {
          release = () => resolve(account("late"));
        }),
    });
    const pending = slow.flows.create({ name: "L", email: "late@x.test", password: PASSWORD });
    state().signOut();
    release();
    const result = await pending;
    assert.deepEqual([result.ok, !result.ok && result.dropped], [false, true]);
    assert.deepEqual(state().accounts.items, []);
    assert.equal(slow.reloads.length, 0);
  });
});
