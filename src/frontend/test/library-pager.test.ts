import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { libraryEndEvent, libraryPageEvent, libraryStallEvent } from "@/lib/library-events";
import { pagerStalled, requestVisiblePageOnce, withinLookAhead } from "@/lib/library-pager";

describe("withinLookAhead", () => {
  const root = { top: 100, bottom: 700 };
  it("counts a sentinel inside the box and inside the margin below it", () => {
    assert.equal(withinLookAhead({ top: 696, bottom: 696 }, root, 240), true);
    assert.equal(withinLookAhead({ top: 940, bottom: 940 }, root, 240), true);
  });
  it("does not count a sentinel beyond the margin", () => {
    assert.equal(withinLookAhead({ top: 941, bottom: 941 }, root, 240), false);
    assert.equal(withinLookAhead({ top: -200, bottom: -200 }, root, 240), false);
  });
});

describe("requestVisiblePageOnce", () => {
  it("releases the guard when the request is declined, so the next evaluation retries", () => {
    const active = { current: false };
    assert.equal(requestVisiblePageOnce(active, () => false), false);
    assert.equal(active.current, false);
    assert.equal(requestVisiblePageOnce(active, () => true), true);
    assert.equal(active.current, true);
    assert.equal(requestVisiblePageOnce(active, () => assert.fail("guarded")), false);
  });
});

describe("pagerStalled", () => {
  const base = { hasMore: true, loading: false, inRange: true, requested: false };
  it("is the wanting, idle, in-range, unrequested state only", () => {
    assert.equal(pagerStalled(base), true);
    assert.equal(pagerStalled({ ...base, requested: true }), false);
    assert.equal(pagerStalled({ ...base, inRange: false }), false);
    assert.equal(pagerStalled({ ...base, loading: true }), false);
    assert.equal(pagerStalled({ ...base, hasMore: false }), false);
  });
});

describe("library paging events", () => {
  it("words the appended page, the end and the stall in the Catalog area", () => {
    assert.deepEqual(libraryPageEvent(12, 476, 27020), {
      tone: "info", area: "Catalog", sentence: "Library page 12 loaded: 476 of 27020.",
    });
    assert.equal(libraryPageEvent(2, 80, undefined).sentence, "Library page 2 loaded: 80 titles.");
    assert.equal(libraryEndEvent(27020).sentence, "Library reached the end: 27020 titles.");
    assert.deepEqual(libraryStallEvent(), {
      tone: "warn", area: "Catalog", sentence: "Library paging is waiting but no page was requested.",
    });
  });
});
