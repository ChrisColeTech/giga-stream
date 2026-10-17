import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { reloadDecision, type ReloadInput } from "@/lib/library-reload";

const base: ReloadInput = { initial: false, active: true, queryChanged: false, serialChanged: false, dirty: false };

describe("library reload decision", () => {
  it("reads the first time", () => {
    assert.deepEqual(reloadDecision({ ...base, initial: true, active: false }), { reload: true, dirty: false });
  });
  it("does not reload on activation alone", () => {
    assert.deepEqual(reloadDecision(base), { reload: false, dirty: false });
  });
  it("reloads for a changed query", () => {
    assert.equal(reloadDecision({ ...base, queryChanged: true }).reload, true);
  });
  it("reloads for a refresh serial bump", () => {
    assert.equal(reloadDecision({ ...base, serialChanged: true }).reload, true);
  });
  it("defers an invalidation while hidden, then applies it once shown", () => {
    const hidden = reloadDecision({ ...base, active: false, serialChanged: true });
    assert.deepEqual(hidden, { reload: false, dirty: true });
    assert.deepEqual(reloadDecision({ ...base, active: false, dirty: hidden.dirty }), { reload: false, dirty: true });
    assert.deepEqual(reloadDecision({ ...base, dirty: hidden.dirty }), { reload: true, dirty: false });
  });
});
