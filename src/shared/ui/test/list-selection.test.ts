import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  forQuery, isTicked, keepOnly, loadedState, matchingOffer, NO_SELECTION, removeId, selectAllMatching, selectedCount,
  tickLoaded, tickRange, tickRow, type ListSelection,
} from "../src/lib/list-selection";

const ids = (selection: ListSelection): string[] => (selection.mode === "ids" ? [...selection.ids].sort() : []);
const LOADED = Array.from({ length: 100 }, (_, at) => `c${at}`);

describe("ticks are ids, so they outlive their rows", () => {
  it("a row tick adds and removes one id", () => {
    const one = tickRow(NO_SELECTION, "c3", true);
    assert.deepEqual(ids(one), ["c3"]);
    assert.equal(isTicked(one, "c3"), true);
    assert.equal(isTicked(tickRow(one, "c3", false), "c3"), false);
  });
  it("ticks on page 1 and on page 30 are one selection, whichever rows are mounted", () => {
    let selection = NO_SELECTION;
    for (let at = 0; at < 30; at += 1) selection = tickRow(selection, `c${at}`, true);
    for (let at = 3000; at < 3030; at += 1) selection = tickRow(selection, `c${at}`, true);
    assert.equal(selectedCount(selection, 5003), 60);
    assert.equal(isTicked(selection, "c5") && isTicked(selection, "c3010"), true);
  });
  it("a removed row leaves the selection; a bulk run keeps only the ids it names", () => {
    assert.deepEqual(ids(removeId(keepOnly(["a", "b"]), "a")), ["b"]);
    assert.deepEqual(ids(keepOnly(["x"])), ["x"]);
  });
});

describe("the header tick means the loaded rows", () => {
  it("ticks every loaded row, by id, and clears", () => {
    const all = tickLoaded(LOADED, true);
    assert.equal(selectedCount(all, 5003), 100);
    assert.equal(loadedState(all, LOADED), true);
    assert.deepEqual(tickLoaded(LOADED, false), NO_SELECTION);
  });
  it("reads all, none or some of the loaded rows", () => {
    assert.equal(loadedState(NO_SELECTION, LOADED), false);
    assert.equal(loadedState(tickRow(NO_SELECTION, "c1", true), LOADED), "mixed");
    assert.equal(loadedState(NO_SELECTION, []), false);
  });
});

describe("Select all M matching is a separate step", () => {
  it("is offered only once every loaded row is ticked and the query holds more", () => {
    assert.equal(matchingOffer(NO_SELECTION, LOADED, 5003), null);
    assert.equal(matchingOffer(tickLoaded(LOADED, true), LOADED, 5003), 5003);
    assert.equal(matchingOffer(tickLoaded(LOADED, true), LOADED, 100), null);
    assert.equal(matchingOffer(selectAllMatching("q"), LOADED, 5003), null);
  });
  it("selects every row of the query but the ones unticked since", () => {
    const all = tickRow(selectAllMatching("kind=stream"), "c7", false);
    assert.equal(isTicked(all, "c4999"), true);
    assert.equal(isTicked(all, "c7"), false);
    assert.equal(selectedCount(all, 5003), 5002);
    assert.equal(selectedCount(tickRow(all, "c7", true), 5003), 5003);
  });
  it("returns to ids mode, empty, when the query changes; ids survive a query change", () => {
    const all = selectAllMatching("q=news");
    assert.deepEqual(forQuery(all, "q=sport"), NO_SELECTION);
    assert.equal(forQuery(all, "q=news"), all);
    const some = tickRow(NO_SELECTION, "c1", true);
    assert.equal(forQuery(some, "q=sport"), some);
  });
});

describe("shift-click ticks a range by index", () => {
  const loaded = (missing: ReadonlySet<number>) => (index: number) => (missing.has(index) ? undefined : `c${index}`);
  it("ticks every row between, in either order", () => {
    const result = tickRange(NO_SELECTION, 12, 8, true, loaded(new Set()));
    assert.equal(result.kind, "ticked");
    if (result.kind === "ticked") assert.equal(selectedCount(result.selection, 5003), 5);
  });
  it("answers the rows of unloaded pages first and changes nothing", () => {
    const result = tickRange(NO_SELECTION, 95, 205, true, loaded(new Set([100, 101, 150])));
    assert.deepEqual(result, { kind: "missing", indexes: [100, 101, 150] });
  });
});
