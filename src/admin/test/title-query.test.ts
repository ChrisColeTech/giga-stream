import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  runSearch,
  START_VIEW,
  titleReads,
  typeSearch,
  withKind,
  withSort,
  type TitleView,
} from "@/lib/title-query";

const at3: TitleView = { ...START_VIEW, page: 3 };

describe("the reads of a view", () => {
  it("browse kind=all with both chips, the one kind with one", () => {
    assert.deepEqual(titleReads(START_VIEW), [{ route: "browse", query: { kind: "all", sort: "newest", page: 1 } }]);
    const tv = withKind(START_VIEW, "tv");
    assert.deepEqual(titleReads(tv), [{ route: "browse", query: { kind: "tv", sort: "newest", page: 1 } }]);
  });

  it("search once per ticked kind", () => {
    const view = runSearch(typeSearch(START_VIEW, "  matrix "));
    assert.deepEqual(titleReads(view), [
      { route: "search", query: { q: "matrix", kind: "movie", page: 1 } },
      { route: "search", query: { q: "matrix", kind: "tv", page: 1 } },
    ]);
  });
});

describe("the search runs by Enter only", () => {
  it("typing changes the field, not the reads", () => {
    const typed = typeSearch(at3, "dune");
    assert.deepEqual([typed.search, typed.page, titleReads(typed)[0]?.route], ["", 3, "browse"]);
    const run = runSearch(typed);
    assert.deepEqual([run.search, run.page], ["dune", 1]);
  });

  it("an emptied field run reads the browse list again", () => {
    const back = runSearch(typeSearch(runSearch(typeSearch(START_VIEW, "x")), ""));
    assert.equal(titleReads(back)[0]?.route, "browse");
  });
});

describe("a change returns to page 1", () => {
  it("a kind change and a sort change", () => {
    assert.equal(withKind(at3, "tv").page, 1);
    assert.equal(withSort(at3, "trending").page, 1);
  });

  it("the Kind select picks one kind or both; the same pick changes nothing", () => {
    const tvOnly = withKind(START_VIEW, "tv");
    assert.deepEqual(tvOnly.kinds, ["tv"]);
    assert.equal(withKind(tvOnly, "tv"), tvOnly);
    assert.deepEqual(withKind(tvOnly, "all").kinds, ["movie", "tv"]);
    assert.equal(withKind(START_VIEW, "all"), START_VIEW);
  });
});
