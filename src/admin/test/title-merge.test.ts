import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergePages } from "@/lib/title-merge";
import type { AdminTitleRow } from "@/services/schemas/title-schema";

const row = (id: string, title: string): AdminTitleRow => ({
  id,
  kind: id.startsWith("tv") ? "tv" : "movie",
  title,
  state: "synced",
});

describe("two kinds merged", () => {
  it("orders by title, keeps a repeated row once, takes the larger totalPages", () => {
    const merged = mergePages(
      [
        { items: [row("movie-2", "Zulu"), row("movie-1", "alpha")], page: 1, totalPages: 3, totalResults: 40 },
        { items: [row("tv-1", "Mike"), row("movie-1", "alpha")], page: 1, totalPages: 9, totalResults: 10 },
      ],
      1,
    );
    assert.deepEqual(merged.items.map((item) => item.id), ["movie-1", "tv-1", "movie-2"]);
    assert.deepEqual([merged.totalPages, merged.totalResults], [9, 50]);
  });

  it("passes one page through untouched", () => {
    const one = { items: [row("movie-2", "Z"), row("movie-1", "A")], page: 2, totalPages: 4, totalResults: 80 };
    assert.equal(mergePages([one], 2), one);
  });
});
