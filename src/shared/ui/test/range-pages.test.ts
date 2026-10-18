import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAX_UNSCROLLED_PAGES } from "../src/lib/pager-rules";
import { LOOK_AHEAD_ROWS, pageSpan, pagesForRange, pagesToRequest, type PageAsk } from "../src/lib/range-pages";

const ask = (over: Partial<PageAsk> = {}): PageAsk => ({
  range: { first: 0, last: 11 },
  visibleRows: 10,
  total: 5000,
  pageSize: 100,
  unscrolled: 0,
  isLoaded: () => false,
  inFlight: new Set(),
  ...over,
});

describe("pagesForRange and pageSpan", () => {
  it("names the pages a range of rows touches, clamped to the list", () => {
    assert.deepEqual(pagesForRange(0, 11, 100, 5000), [0]);
    assert.deepEqual(pagesForRange(95, 105, 100, 5000), [0, 1]);
    assert.deepEqual(pagesForRange(-20, 4, 100, 5000), [0]);
    assert.deepEqual(pagesForRange(4990, 6000, 100, 5000), [49]);
    assert.deepEqual(pagesForRange(0, 10, 100, 0), []);
  });
  it("spans a page, the last one cut at the list's end", () => {
    assert.deepEqual(pageSpan(3, 100, 5000), { first: 300, last: 399 });
    assert.deepEqual(pageSpan(50, 100, 5003), { first: 5000, last: 5002 });
  });
});

describe("pagesToRequest", () => {
  it("asks for the page the window shows, plus the look-ahead's", () => {
    assert.deepEqual(pagesToRequest(ask()), [0]);
    assert.ok(LOOK_AHEAD_ROWS >= 6);
    assert.deepEqual(pagesToRequest(ask({ range: { first: 90, last: 97 } })), [0, 1]);
  });
  it("asks for the middle after a scrollbar drag to the middle", () => {
    assert.deepEqual(pagesToRequest(ask({ range: { first: 2498, last: 2511 } })), [25, 24]);
  });
  it("skips a loaded page and a page in flight", () => {
    const range = { first: 90, last: 97 };
    assert.deepEqual(pagesToRequest(ask({ range, isLoaded: (page) => page === 0 })), [1]);
    assert.deepEqual(pagesToRequest(ask({ range, inFlight: new Set([1]) })), [0]);
    assert.deepEqual(pagesToRequest(ask({ range, isLoaded: () => true })), []);
  });
  it("asks for the page nearest the viewport first", () => {
    assert.deepEqual(pagesToRequest(ask({ range: { first: 103, last: 112 } })), [1, 0]);
  });
  it("is bounded by the geometry: ceil(visible / page) + 2 pages an evaluation", () => {
    const wide = ask({ range: { first: 0, last: 999 }, visibleRows: 150 });
    assert.equal(pagesToRequest(wide).length, 4);
  });
  it("is bounded by the unscrolled chain, so a failing read cannot loop", () => {
    assert.deepEqual(pagesToRequest(ask({ unscrolled: MAX_UNSCROLLED_PAGES })), []);
    const nearly = ask({ range: { first: 0, last: 999 }, visibleRows: 900, unscrolled: MAX_UNSCROLLED_PAGES - 1 });
    assert.equal(pagesToRequest(nearly).length, 1);
  });
  it("asks nothing for an empty window or list", () => {
    assert.deepEqual(pagesToRequest(ask({ range: { first: 0, last: -1 } })), []);
    assert.deepEqual(pagesToRequest(ask({ total: 0 })), []);
  });
});
