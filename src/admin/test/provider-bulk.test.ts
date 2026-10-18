import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { ApiError } from "@giga/http/api-error";
import { deleteQuestion, planProviderBulk, providerBulkReason, PROVIDER_BULK_WORDS } from "@/lib/provider-bulk";
import { createBulkRunner } from "@/services/bulk-run";
import { createProviderBulkCall } from "@/services/provider-bulk";
import type { AdminProvider } from "@/services/schemas/provider-schema";
import { useAppStore } from "@/store/app-store";
import { resetStore, signInForTest } from "./support/store";

const state = () => useAppStore.getState();
const provider = (id: number, active = true): AdminProvider => ({
  id,
  name: `P${id}`,
  source: `p${id}`,
  is_active: active,
  order: id,
  family: "embed",
  created_at: "2026-10-01T09:00:00.000Z",
});
const LIST = [provider(1), provider(2), provider(3, false)];
const ids = (plan: { runnable: ReadonlyArray<{ id: number }> }): number[] => plan.runnable.map((item) => item.id);
const IDLE = { busy: false, unreachable: false };

beforeEach(() => {
  resetStore();
  signInForTest();
});

describe("the providers plan", () => {
  it("skips a provider already in the wanted state with its reason", () => {
    const enable = planProviderBulk("enable", LIST, [1, 3]);
    assert.deepEqual([ids(enable), enable.refused.map((r) => [r.id, r.reason])], [[3], [[1, "Already enabled."]]]);
    const disable = planProviderBulk("disable", LIST, [1, 3]);
    assert.deepEqual([ids(disable), disable.refused[0]?.reason], [[1], "Already disabled."]);
  });

  it("deletes every ticked row, in list order", () => {
    assert.deepEqual(ids(planProviderBulk("delete", LIST, [3, 1])), [1, 3]);
  });

  it("disables each verb with its reason: nothing ticked, all skipped, busy, unreachable", () => {
    const none = planProviderBulk("enable", LIST, []);
    assert.equal(providerBulkReason("enable", none, 0, IDLE), "Tick a row first");
    const all = planProviderBulk("enable", LIST, [1, 2]);
    assert.equal(providerBulkReason("enable", all, 2, IDLE), "Every ticked provider is already enabled.");
    const off = planProviderBulk("disable", LIST, [3]);
    assert.equal(providerBulkReason("disable", off, 1, IDLE), "Every ticked provider is already disabled.");
    const fine = planProviderBulk("delete", LIST, [1]);
    assert.equal(providerBulkReason("delete", fine, 1, IDLE), undefined);
    assert.equal(providerBulkReason("delete", fine, 1, { busy: true, unreachable: false }), "Saving.");
    assert.equal(providerBulkReason("delete", fine, 1, { busy: false, unreachable: true }), "The admin backend cannot be reached.");
    assert.equal(deleteQuestion(1), "Delete 1 provider?");
  });
});

describe("a run through the shared runner", () => {
  it("runs one PUT per row, a failure does not stop the rest, one summary and one re-read", async () => {
    state().providersLoaded(LIST);
    state().providersSetTicked([1, 2, 3]);
    const sent: string[] = [];
    const call = createProviderBulkCall({
      service: {
        update: async (id, body) => {
          sent.push(`${id}:${JSON.stringify(body)}`);
          if (id === 2) throw new ApiError("provider.invalid", "Refused.", 422);
          return { ...provider(id), is_active: false };
        },
        remove: async (id) => ({ id }),
      },
      store: () => useAppStore.getState(),
    });
    let rereads = 0;
    const plan = planProviderBulk("disable", state().providers.items, state().providers.ticked);
    const outcome = await createBulkRunner(() => useAppStore.getState()).run({
      words: PROVIDER_BULK_WORDS.disable,
      area: "Provider",
      plan,
      perform: call("disable"),
      finish: (result) => state().providersSetTicked(state().providers.ticked.filter((id) => !result.done.some((d) => d.id === id))),
      reread: async () => void (rereads += 1),
    });
    assert.deepEqual(sent, ['1:{"enabled":false}', '2:{"enabled":false}']);
    assert.deepEqual([outcome?.done.length, outcome?.failed[0]?.sentence, outcome?.refused[0]?.reason], [1, "Refused.", "Already disabled."]);
    assert.equal(state().notice?.sentence, "Disabled 1 provider; 1 failed; 1 skipped.");
    assert.deepEqual([rereads, state().providers.ticked], [1, [2, 3]]);
  });
});
