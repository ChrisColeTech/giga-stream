import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { selectAllState } from "@/lib/account-rows";
import { useAppStore } from "@/store/app-store";
import type { AdminAccount } from "@/types/admin-account";
import { resetStore } from "./support/store";

const state = () => useAppStore.getState();
const account = (id: string, email: string, disabled = false): AdminAccount => ({
  id,
  email,
  name: id,
  disabled,
  createdAt: 1,
  updatedAt: 1,
});
const emails = (): string[] => state().accounts.items.map((item) => item.email);

beforeEach(() => resetStore());

describe("the accounts slice", () => {
  it("moves idle, loading, ready and failed", () => {
    assert.equal(state().accounts.status, "idle");
    state().accountsStartLoad();
    assert.equal(state().accounts.status, "loading");
    state().accountsLoaded([account("a", "a@x.test")]);
    assert.equal(state().accounts.status, "ready");
    state().accountsLoadFailed(false);
    assert.deepEqual([state().accounts.status, emails()], ["failed", ["a@x.test"]], "the last items stay");
  });

  it("keeps the list sorted by lower-cased email and replaces by id", () => {
    state().accountsLoaded([account("b", "Bob@x.test"), account("a", "ann@x.test")]);
    state().accountUpsert(account("c", "carl@x.test"));
    state().accountUpsert(account("d", "AARON@x.test"));
    assert.deepEqual(emails(), ["AARON@x.test", "ann@x.test", "Bob@x.test", "carl@x.test"]);
    state().accountUpsert({ ...account("b", "zed@x.test"), name: "renamed" });
    assert.deepEqual(emails(), ["AARON@x.test", "ann@x.test", "carl@x.test", "zed@x.test"]);
    assert.equal(state().accounts.items.length, 4, "replaced, not added");
  });

  it("removes a row and prunes the ticks of rows that are gone", () => {
    state().accountsLoaded([account("a", "a@x.test"), account("b", "b@x.test")]);
    state().accountsTickAll(true);
    state().accountRemove("a");
    assert.deepEqual(state().accounts.ticked, ["b"]);
    state().accountsLoaded([account("c", "c@x.test")]);
    assert.deepEqual(state().accounts.ticked, []);
  });

  it("ticks one, ticks all, and reads mixed over a part", () => {
    state().accountsLoaded([account("a", "a@x.test"), account("b", "b@x.test")]);
    const mixed = () => selectAllState(state().accounts.items, state().accounts.ticked);
    assert.equal(mixed(), false);
    state().accountTick("a", true);
    assert.equal(mixed(), "mixed");
    state().accountTick("b", true);
    assert.equal(mixed(), true);
    state().accountTick("a", false);
    assert.equal(mixed(), "mixed");
    state().accountsTickAll(false);
    assert.equal(mixed(), false);
  });

  it("sets unreachable on a transport failure and clears it on the next successful read", () => {
    state().accountsMarkUnreachable(true);
    assert.equal(state().accounts.unreachable, true);
    state().accountsLoaded([]);
    assert.equal(state().accounts.unreachable, false);
    state().accountsLoadFailed(true);
    assert.equal(state().accounts.unreachable, true);
  });
});
