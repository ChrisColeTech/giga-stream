import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  START_STORED,
  isDefaultQuery,
  sortValueOf,
  storedKey,
  storedParams,
  withSearch,
  withSortValue,
} from "@/lib/title-stored-query";

describe("the stored query builder", () => {
  it("asks for the default page exactly as the contract names it", () => {
    assert.equal(storedParams(START_STORED, 0), "limit=100&offset=0&kind=all&origin=all&sort=title&dir=asc");
  });

  it("sends q only when a search was run, and edited and enabled only when they filter", () => {
    const query = { ...START_STORED, q: "dune", edited: "true", enabled: "false", kind: "tv", origin: "manual" } as const;
    const params = new URLSearchParams(storedParams(query, 200, 50));
    assert.deepEqual(Object.fromEntries(params), {
      limit: "50", offset: "200", q: "dune", kind: "tv", origin: "manual", edited: "true", enabled: "false", sort: "title", dir: "asc",
    });
    assert.ok(!storedParams(START_STORED, 0).includes("q=") && !storedParams(START_STORED, 0).includes("edited"));
  });

  it("encodes a search that holds & or spaces", () => {
    const params = new URLSearchParams(storedParams({ ...START_STORED, q: "a & b" }, 0));
    assert.equal(params.get("q"), "a & b");
  });

  it("keys a query without its page, so a page of another query is told apart", () => {
    assert.equal(storedKey(START_STORED), storedKey({ ...START_STORED }));
    assert.notEqual(storedKey(START_STORED), storedKey({ ...START_STORED, kind: "movie" }));
    assert.ok(!storedKey(START_STORED).includes("offset=100"));
  });

  it("reads the sort Select as a column and a direction, and ignores an unknown value", () => {
    const sorted = withSortValue(START_STORED, "year:desc");
    assert.deepEqual([sorted.sort, sorted.dir, sortValueOf(sorted)], ["year", "desc", "year:desc"]);
    assert.equal(withSortValue(START_STORED, "bogus:up"), START_STORED);
    for (const sort of ["title", "year", "rating", "fetched"]) assert.ok(withSortValue(START_STORED, `${sort}:asc`).sort === sort);
  });

  it("trims the run search, and the default query is the one with no narrowing", () => {
    assert.equal(withSearch(START_STORED, "  alien ").q, "alien");
    assert.ok(isDefaultQuery(START_STORED) && !isDefaultQuery(withSearch(START_STORED, "a")));
  });
});
