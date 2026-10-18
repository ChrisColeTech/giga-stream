import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import type { AdminProvider } from "@/services/schemas/provider-schema";
import { useAppStore } from "@/store/app-store";
import { resetStore } from "./support/store";

const state = () => useAppStore.getState();
const provider = (id: number, order = id, extra: Partial<AdminProvider> = {}): AdminProvider => ({
  id,
  name: `P${id}`,
  source: `p${id}`,
  is_active: true,
  order,
  family: "embed",
  created_at: "2026-10-01T09:00:00.000Z",
  ...extra,
});

beforeEach(() => resetStore());

describe("the providers slice", () => {
  it("starts idle and walks loading, ready and failed, keeping the last items on a failure", () => {
    assert.equal(state().providers.status, "idle");
    state().providersStartLoad();
    assert.equal(state().providers.status, "loading");
    state().providersLoaded([provider(2), provider(1)]);
    assert.deepEqual([state().providers.status, state().providers.items.map((p) => p.id)], ["ready", [1, 2]]);
    state().providersLoadFailed(true);
    const { status, unreachable, items } = state().providers;
    assert.deepEqual([status, unreachable, items.length], ["failed", true, 2]);
    state().providersLoaded([provider(1)]);
    assert.equal(state().providers.unreachable, false);
  });

  it("replaces by id in order, removes, and drops the ticks of rows that go", () => {
    state().providersLoaded([provider(1), provider(2), provider(3)]);
    state().providerTick(2, true);
    state().providerTick(3, true);
    state().providerUpsert(provider(2, 9, { name: "moved" }));
    assert.deepEqual(state().providers.items.map((p) => p.id), [1, 3, 2]);
    state().providerRemove(3);
    assert.deepEqual(state().providers.ticked, [2]);
    state().providerTick(2, false);
    assert.deepEqual(state().providers.ticked, []);
  });

  it("ticks all and none, and keeps only the named ticks that still exist", () => {
    state().providersLoaded([provider(1), provider(2)]);
    state().providersTickAll(true);
    assert.deepEqual(state().providers.ticked, [1, 2]);
    state().providersSetTicked([2, 99]);
    assert.deepEqual(state().providers.ticked, [2]);
    state().providersTickAll(false);
    assert.deepEqual(state().providers.ticked, []);
  });

  it("resets for a new session", () => {
    state().providersLoaded([provider(1)]);
    state().providersReset(4);
    assert.deepEqual(state().providers, { status: "idle", items: [], unreachable: false, ticked: [], session: 4 });
  });
});
