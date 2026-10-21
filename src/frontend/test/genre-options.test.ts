import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeGenreOptions, retainGenreFacets } from "@/lib/genre-options";

describe("stable Library genre options", () => {
  it("keeps accepted facets through loading, merges selection, then replaces them on acceptance", () => {
    const firstAnswer = ["Drama", "Crime", "Action"];
    const accepted = retainGenreFacets([], firstAnswer);
    assert.strictEqual(accepted, firstAnswer);
    assert.strictEqual(mergeGenreOptions(accepted, ["Crime"]), accepted,
      "selecting an existing facet keeps the vocabulary identity and order");

    const loading = retainGenreFacets(accepted, null);
    assert.strictEqual(loading, accepted, "a null page is loading, not an accepted empty vocabulary");
    assert.deepEqual(mergeGenreOptions(loading, ["Noir", "Crime"]), ["Drama", "Crime", "Action", "Noir"]);

    const nextAnswer = ["Comedy", "Family"];
    const replaced = retainGenreFacets(loading, nextAnswer);
    assert.strictEqual(replaced, nextAnswer);
    assert.deepEqual(mergeGenreOptions(replaced, ["Crime"]), ["Comedy", "Family", "Crime"]);
  });

  it("accepts an intentionally empty vocabulary and appends selected values without duplicates", () => {
    const emptyAnswer: readonly string[] = [];
    const emptied = retainGenreFacets(["Drama"], emptyAnswer);
    assert.strictEqual(emptied, emptyAnswer);
    assert.deepEqual(mergeGenreOptions(emptied, ["Drama", "Drama"]), ["Drama"]);
  });

  it("retains identity for equal accepted facets and removes duplicate facet entries in stable order", () => {
    const current = ["Drama", "Crime"];
    assert.strictEqual(retainGenreFacets(current, ["Drama", "Crime"]), current);
    assert.deepEqual(mergeGenreOptions(["Drama", "Crime", "Drama"], ["Crime"]), ["Drama", "Crime"]);
  });
});
