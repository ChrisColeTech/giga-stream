import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MEMBER_MISSING } from "@/lib/collections-copy";
import { memberRows } from "@/lib/collections-members";
import type { ItemRef, LibraryItem } from "@/types/library";

const ITEMS: readonly LibraryItem[] = [
  {
    ref: { kind: "title", id: "movie-603" },
    kind: "movie",
    title: "The Matrix",
    year: 1999,
    genres: [],
    favorite: false,
  },
  {
    ref: { kind: "local", id: "local-1" },
    kind: "local",
    title: "Holiday footage",
    genres: [],
    favorite: false,
  },
];

describe("member rows", () => {
  it("resolves each reference to its title and year, in order", () => {
    const refs: readonly ItemRef[] = [
      { kind: "title", id: "movie-603" },
      { kind: "local", id: "local-1" },
    ];
    assert.deepEqual(memberRows(refs, ITEMS), [
      { key: "title:movie-603", title: "The Matrix", year: "1999" },
      { key: "local:local-1", title: "Holiday footage", year: "" },
    ]);
  });

  it("matches on kind as well as id, so a title never resolves to a local file", () => {
    const refs: readonly ItemRef[] = [{ kind: "title", id: "local-1" }];
    assert.deepEqual(memberRows(refs, ITEMS), [{ key: "title:local-1", title: MEMBER_MISSING, year: "" }]);
  });

  it("keeps a row for a reference the library does not hold, so the count of rows is the count of members", () => {
    const refs: readonly ItemRef[] = [{ kind: "title", id: "movie-0" }, { kind: "title", id: "movie-603" }];
    const rows = memberRows(refs, ITEMS);
    assert.equal(rows.length, refs.length);
    assert.equal(rows[0]?.title, MEMBER_MISSING);
  });

  it("an empty collection has no rows", () => {
    assert.deepEqual(memberRows([], ITEMS), []);
  });
});
