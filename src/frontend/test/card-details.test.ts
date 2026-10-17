import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detailFacts, detailKindLine, detailRuntime, ratingBadge, ratingOutOfTen } from "@/lib/card-details";
import { LibraryItemSchema, LibraryPageSchema } from "@/services/schemas/library-schema";

const row = {
  ref: { kind: "title", id: "movie-1236045" }, kind: "movie", title: "Sample", year: 2025, genres: ["Drama"], favorite: false,
};

describe("the rating badge", () => {
  it("writes one decimal, rounded for display only", () => {
    assert.equal(ratingBadge(7.142), "7.1");
    assert.equal(ratingBadge(7.96), "8.0");
    assert.equal(ratingBadge(10), "10.0");
    assert.equal(ratingOutOfTen(7.142), "7.1 / 10");
  });

  it("agrees with the popover line for the same (card) rating", () => {
    assert.equal(ratingBadge(7.159), "7.2");
    assert.equal(ratingOutOfTen(7.159), `${ratingBadge(7.159)} / 10`);
  });

  it("is absent for an unknown, unrated or invalid rating", () => {
    assert.equal(ratingBadge(undefined), undefined);
    assert.equal(ratingBadge(0), undefined);
    assert.equal(ratingBadge(-1), undefined);
    assert.equal(ratingBadge(Number.NaN), undefined);
    assert.equal(ratingOutOfTen(undefined), undefined);
  });
});

describe("the details popover's facts", () => {
  it("names a movie, and a series by its seasons and episodes", () => {
    assert.equal(detailKindLine({ kind: "movie" }), "Movie");
    assert.equal(
      detailKindLine({ kind: "tv", seasons: [{ season: 1, episodeCount: 6 }, { season: 2, episodeCount: 8 }] }),
      "2 seasons · 14 episodes",
    );
    assert.equal(detailKindLine({ kind: "tv" }), "Series");
    assert.equal(detailKindLine({ kind: "tv", seasons: [] }), "Series");
  });

  it("writes a runtime in hours and minutes, and leaves out an unknown one", () => {
    assert.equal(detailRuntime(106 * 60_000), "1 h 46 min");
    assert.equal(detailRuntime(48 * 60_000), "48 min");
    assert.equal(detailRuntime(undefined), undefined);
    assert.equal(detailRuntime(0), undefined);
  });

  it("joins year, kind and runtime, falling back to the card's own facts before the detail is read", () => {
    const detail = { id: "movie-1", kind: "movie" as const, title: "T", year: 2025, genres: [], cast: [], runtimeMs: 106 * 60_000 };
    assert.deepEqual(detailFacts({ kind: "movie", year: 2024 }, detail), ["2025", "Movie", "1 h 46 min"]);
    assert.deepEqual(detailFacts({ kind: "tv", year: 2011 }, undefined), ["2011", "Series"]);
    assert.deepEqual(detailFacts({ kind: "movie" }, undefined), ["Movie"]);
  });
});

describe("the library item schema and the rating", () => {
  it("keeps the rating unrounded when the list carries one", () => {
    assert.equal(LibraryItemSchema.parse({ ...row, rating: 7.142 }).rating, 7.142);
  });

  it("still parses a row without a rating", () => {
    const parsed = LibraryItemSchema.parse(row);
    assert.equal(parsed.rating, undefined);
    assert.equal(parsed.title, "Sample");
  });

  it("drops a malformed rating, not the row or its siblings", () => {
    const page = LibraryPageSchema.parse({
      items: [{ ...row, rating: "high" }, { ...row, ref: { kind: "title", id: "movie-2" }, rating: 42 }, { ...row, rating: 6.5 }],
      facets: { genres: [], years: [] }, trending: false, titlesAvailable: true,
    });
    assert.deepEqual(page.items.map((one) => one.rating), [undefined, undefined, 6.5]);
  });
});
