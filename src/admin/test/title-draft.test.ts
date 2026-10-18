import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { discardForm, isDirty, setFields, startForm } from "@/lib/record-form";
import { createReason, firstCreateRefusal, firstSaveRefusal, formKeyOf, titleFieldOf } from "@/lib/title-checks";
import { draftOfTitle, EMPTY_NEW_TITLE, sameTitleDraft } from "@/lib/title-draft";
import { seasonCounts, sourcesOf } from "@/lib/title-sources";
import type { AdminTitleDetail } from "@/services/schemas/title-schema";

const SERIES: AdminTitleDetail = {
  id: "tv-1399",
  kind: "tv",
  title: "Game of Thrones",
  state: "edited",
  editedFields: ["plot"],
  seasons: [{ season: 1, episodeCount: 10 }, { season: 2, episodeCount: 1 }],
};
const SHAPE = { manual: false, series: true };

describe("the title draft", () => {
  it("reads absent values as empty and a missing enabled as on", () => {
    const draft = draftOfTitle(SERIES);
    assert.deepEqual([draft.year, draft.enabled, draft.plot, draft.seasons.length], ["", true, "", 2]);
  });

  it("is dirty by value and discards back to the baseline", () => {
    const start = startForm(draftOfTitle(SERIES));
    const typed = setFields(start, { plot: "new" });
    assert.ok(isDirty(typed, sameTitleDraft));
    assert.ok(!isDirty(setFields(typed, { plot: "" }), sameTitleDraft));
    assert.ok(!isDirty(discardForm(typed), sameTitleDraft));
  });
});

describe("the title checks", () => {
  it("disable Create with Title, then Year", () => {
    assert.equal(createReason(EMPTY_NEW_TITLE, false, false), "Title is required.");
    assert.equal(createReason({ ...EMPTY_NEW_TITLE, title: "A" }, false, false), "Year is required.");
    assert.equal(createReason({ ...EMPTY_NEW_TITLE, title: "A", year: "1999" }, true, false), "Saving.");
  });

  it("refuse a year outside 1800 to 2200 and a bad rating, runtime or TMDB id", () => {
    assert.equal(firstCreateRefusal({ title: "A", kind: "movie", year: "1700" })?.field, "year");
    const draft = draftOfTitle(SERIES);
    assert.equal(firstSaveRefusal({ ...draft, rating: "11" }, SHAPE)?.field, "rating");
    assert.equal(firstSaveRefusal({ ...draft, runtime: "x" }, { manual: false, series: false })?.field, "runtimeMs");
    assert.equal(firstSaveRefusal({ ...draft, tmdbId: "0" }, { manual: true, series: true })?.field, "tmdbId");
    assert.equal(firstSaveRefusal(draft, SHAPE), null);
  });

  it("refuse a season number used twice on a manual series", () => {
    const seasons = [
      { season: 1, episodes: [] },
      { season: 1, episodes: [] },
    ];
    assert.deepEqual(firstSaveRefusal({ ...draftOfTitle(SERIES), seasons }, { manual: true, series: true }), {
      field: "seasons",
      sentence: "Each season number is used once.",
    });
  });

  it("map a backend field to its row", () => {
    assert.equal(titleFieldOf("seasons.0.episodes.3.title"), "seasons");
    assert.equal(formKeyOf("runtimeMs"), "runtime");
    assert.equal(titleFieldOf("nope"), undefined);
  });
});

describe("the read-only parts", () => {
  it("count a synced series' episodes and narrow the sources", () => {
    assert.deepEqual(seasonCounts(SERIES), [
      { season: 1, episodes: "10 episodes" },
      { season: 2, episodes: "1 episode" },
    ]);
    const sources = sourcesOf({ sources: [{ name: "VidSrc", url: "https://v.test/1" }, { name: 3 }] });
    assert.deepEqual(sources.map((s) => s.name), ["VidSrc"]);
  });
});
