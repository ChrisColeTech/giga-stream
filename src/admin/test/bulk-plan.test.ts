import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { ApiError } from "@giga/http/api-error";
import { bulkNotes, bulkSummary, planBulk, runBulk } from "@/lib/bulk-plan";
import { bulkVerbReason, planAccountBulk } from "@/lib/account-bulk";
import { createAccountBulkCall } from "@/services/account-bulk";
import { createBulkRunner } from "@/services/bulk-run";
import { useAppStore } from "@/store/app-store";
import type { AdminAccount } from "@/types/admin-account";
import { resetStore, signInForTest } from "./support/store";

const account = (id: string, disabled = false): AdminAccount => ({
  id,
  username: `${id}@x.test`,
  disabled,
  createdAt: 1,
  updatedAt: 1,
});
const ids = (plan: { runnable: ReadonlyArray<{ id: string | number }> }): Array<string | number> => plan.runnable.map((i) => i.id);
const state = () => useAppStore.getState();

describe("the generic plan", () => {
  it("keeps the order and splits runnable from refused with the reason", () => {
    const plan = planBulk([{ id: 1, label: "one" }, { id: 2, label: "two" }, { id: 3, label: "three" }], (item) =>
      item.id === 2 ? "No." : null,
    );
    assert.deepEqual(plan.runnable.map((i) => i.id), [1, 3]);
    assert.deepEqual(plan.refused, [{ id: 2, label: "two", reason: "No." }]);
  });
});

describe("the accounts plan", () => {
  const list = [account("me"), account("a"), account("b"), account("off", true)];

  it("runs every ticked account when nothing is refused", () => {
    const plan = planAccountBulk("disable", list, ["a", "b"], "me");
    assert.deepEqual([ids(plan), plan.refused.length], [["a", "b"], 0]);
    assert.deepEqual(ids(planAccountBulk("delete", list, ["a", "off"], "me")), ["a", "off"]);
  });

  it("refuses the signed-in account for Disable and Delete, compared by id, with a visible reason", () => {
    for (const verb of ["disable", "delete"] as const) {
      const plan = planAccountBulk(verb, list, ["me", "a"], "me");
      assert.deepEqual([ids(plan), plan.refused.map((r) => r.id)], [["a"], ["me"]], verb);
      assert.match(plan.refused[0]?.reason ?? "", /own account/);
    }
    assert.deepEqual(ids(planAccountBulk("disable", [{ ...account("7") }, account("z")], ["7"], 7)), [], "7 and '7' are one id");
  });

  it("skips what is already in the wanted state", () => {
    const enable = planAccountBulk("enable", list, ["a", "off"], "me");
    assert.deepEqual([ids(enable), enable.refused[0]?.reason], [["off"], "Already enabled."]);
    const disable = planAccountBulk("disable", list, ["off", "a"], "me");
    assert.equal(disable.refused[0]?.reason, "Already disabled.");
  });

  it("never takes the last enabled account: the count is carried down the ticked rows", () => {
    const two = [account("a"), account("b"), account("off", true)];
    const plan = planAccountBulk("disable", two, ["a", "b"], null);
    assert.deepEqual([ids(plan), plan.refused[0]?.id, plan.refused[0]?.reason], [["a"], "b", "The last enabled account cannot be disabled."]);
    const del = planAccountBulk("delete", two, ["a", "b", "off"], null);
    assert.deepEqual([ids(del), del.refused[0]?.reason], [["a", "off"], "The last enabled account cannot be deleted."]);
  });

  it("explains a disabled verb: nothing ticked, a run going, unreachable, or every row refused", () => {
    const none = planAccountBulk("delete", list, [], "me");
    const free = { busy: false, unreachable: false };
    assert.equal(bulkVerbReason(none, 0, free), "Tick an account first");
    const some = planAccountBulk("delete", list, ["a"], "me");
    assert.equal(bulkVerbReason(some, 1, free), undefined);
    assert.equal(bulkVerbReason(some, 1, { ...free, busy: true }), "Saving.");
    assert.equal(bulkVerbReason(some, 1, { ...free, unreachable: true }), "The admin backend cannot be reached.");
    const own = planAccountBulk("delete", list, ["me"], "me");
    assert.equal(bulkVerbReason(own, 1, free), "Your own account cannot be deleted here.");
  });
});

describe("the runner", () => {
  it("goes in order, never stops at a failure, and reports done and failed", async () => {
    const plan = planBulk([1, 2, 3, 4].map((id) => ({ id, label: `r${id}` })), () => null);
    const seen: number[] = [];
    const outcome = await runBulk(plan, async (item) => {
      seen.push(item.id);
      if (item.id === 2) return "Boom.";
      if (item.id === 3) throw new Error("secret detail");
      return null;
    });
    assert.deepEqual(seen, [1, 2, 3, 4]);
    assert.deepEqual(outcome.done.map((i) => i.id), [1, 4]);
    assert.deepEqual(outcome.failed.map((i) => [i.id, i.sentence]), [[2, "Boom."], [3, "The request failed."]]);
  });

  it("words the summary and lists failures and skips under the toolbar", async () => {
    const plan = planBulk([1, 2, 3].map((id) => ({ id, label: `r${id}` })), (item) => (item.id === 3 ? "Skipped." : null));
    const outcome = await runBulk(plan, async (item) => (item.id === 2 ? "Failed." : null));
    const words = { past: "Disabled", noun: "account", nouns: "accounts" };
    assert.deepEqual(bulkSummary(words, outcome), { sentence: "Disabled 1 account; 1 failed; 1 skipped.", tone: "warn" });
    assert.deepEqual(bulkNotes(outcome).map((n) => [n.label, n.sentence]), [["r2", "Failed."], ["r3", "Skipped."]]);
    const clean = await runBulk(planBulk([{ id: 1, label: "r1" }], () => null), async () => null);
    assert.deepEqual(bulkSummary(words, clean), { sentence: "Disabled 1 account.", tone: "info" });
  });
});

describe("the accounts bulk run", () => {
  beforeEach(() => {
    resetStore();
    signInForTest();
  });

  function setup(failing: string[]) {
    const calls: string[] = [];
    const service = {
      update: async (id: string | number, patch: Readonly<Record<string, unknown>>) => {
        calls.push(`update:${String(id)}`);
        if (failing.includes(String(id))) throw new ApiError("account.last_admin", "Refused by the server.", 409);
        return { ...account(String(id)), disabled: patch["disabled"] === true };
      },
      remove: async (id: string | number) => (calls.push(`remove:${String(id)}`), { id }),
    };
    const call = createAccountBulkCall({ service, store: () => state() });
    const runner = createBulkRunner(() => state());
    return { calls, call, runner };
  }

  it("runs sequential single-record calls, keeps failed rows ticked, counts the work and re-reads once", async () => {
    state().accountsLoaded([account("a"), account("b"), account("c"), account("d")]);
    state().accountsTickAll(true);
    const { calls, call, runner } = setup(["b"]);
    const plan = planAccountBulk("disable", state().accounts.items, state().accounts.ticked, null);
    const working: number[] = [];
    const unsubscribe = useAppStore.subscribe((now) => working.push(now.work.syncing));
    let rereads = 0;
    const outcome = await runner.run({
      words: { past: "Disabled", noun: "account", nouns: "accounts" },
      area: "Account",
      plan,
      perform: call("disable"),
      finish: (result) =>
        state().accountsSetTicked(state().accounts.ticked.filter((id) => !result.done.some((item) => item.id === id))),
      reread: async () => void (rereads += 1),
    });
    unsubscribe();
    assert.deepEqual(calls, ["update:a", "update:b", "update:c"], "the last enabled account was refused in the plan, not sent");
    assert.deepEqual(outcome?.failed.map((i) => i.id), ["b"]);
    assert.deepEqual(state().accounts.ticked, ["b", "d"], "failed and skipped rows stay ticked; finished ones are unticked");
    assert.equal(state().notice?.sentence, "Disabled 2 accounts; 1 failed; 1 skipped.");
    assert.equal(rereads, 1);
    assert.ok(working.includes(1) && state().work.syncing === 0, "counted while it ran, back to zero after");
    assert.equal(state().accounts.items.find((i) => i.id === "a")?.disabled, true);
  });

  it("deletes through the service and drops the ticks of the rows that went", async () => {
    state().accountsLoaded([account("a"), account("b")]);
    state().accountsTickAll(true);
    const { calls, call, runner } = setup([]);
    const plan = planAccountBulk("delete", state().accounts.items, ["a"], null);
    await runner.run({
      words: { past: "Deleted", noun: "account", nouns: "accounts" },
      area: "Account",
      plan,
      perform: call("delete"),
      finish: () => undefined,
      reread: async () => undefined,
    });
    assert.deepEqual(calls, ["remove:a"]);
    assert.deepEqual([state().accounts.items.map((i) => i.id), state().accounts.ticked], [["b"], ["b"]]);
  });

  it("says nothing and stops when the session ends under the run", async () => {
    state().accountsLoaded([account("a"), account("b"), account("c")]);
    const { calls, call, runner } = setup([]);
    const plan = planAccountBulk("disable", state().accounts.items, ["a", "b"], null);
    const first = call("disable");
    const outcome = await runner.run({
      words: { past: "Disabled", noun: "account", nouns: "accounts" },
      area: "Account",
      plan,
      perform: async (item) => {
        const result = await first(item);
        state().signOut();
        return result;
      },
      finish: () => assert.fail("not finished"),
      reread: async () => assert.fail("not re-read"),
    });
    assert.equal(outcome, null);
    assert.deepEqual(calls, ["update:a"]);
    assert.equal(state().notice, null);
  });
});
