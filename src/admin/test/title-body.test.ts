import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addEpisode, addSeason } from "@/lib/season-edit";
import { isEmptyTitleBody, titleChanges, titleCreateBody } from "@/lib/title-body";
import { draftOfTitle } from "@/lib/title-draft";
import type { AdminTitleDetail } from "@/services/schemas/title-schema";

const MOVIE: AdminTitleDetail = {
  id: "movie-603",
  kind: "movie",
  title: "The Matrix",
  year: 1999,
  rating: 8.2,
  genres: ["Action"],
  tmdbId: 603,
  state: "synced",
  enabled: true,
  plot: "A hacker.",
  cast: ["Keanu"],
  runtimeMs: 8_160_000,
};
const SERIES: AdminTitleDetail = {
  id: "custom-1",
  kind: "tv",
  title: "Mine",
  state: "manual",
  enabled: true,
  seasons: [{ season: 1, episodes: [{ episode: 1, title: "Pilot", season: 1, airDate: "2020-01-01" }] }],
};
const SYNCED = { manual: false, series: false };
const MANUAL_SERIES = { manual: true, series: true };

describe("the create body", () => {
  it("posts the kind, the trimmed title and the year when given", () => {
    assert.deepEqual(titleCreateBody({ title: " A ", kind: "movie", year: "" }), { kind: "movie", title: "A" });
    assert.deepEqual(titleCreateBody({ title: "A", kind: "tv", year: "2001" }), { kind: "tv", title: "A", year: 2001 });
  });
});

describe("the PATCH body", () => {
  it("is empty when nothing changed (the episode's own season is not a change)", () => {
    assert.ok(isEmptyTitleBody(titleChanges(MOVIE, draftOfTitle(MOVIE), SYNCED)));
    assert.ok(isEmptyTitleBody(titleChanges(SERIES, draftOfTitle(SERIES), MANUAL_SERIES)));
  });

  it("sends only the changed fields, in the wire's names and units", () => {
    const draft = { ...draftOfTitle(MOVIE), runtime: "120", genres: "Action, Sci-Fi", enabled: false };
    const expected = { enabled: false, genres: ["Action", "Sci-Fi"], runtimeMs: 7_200_000 };
    assert.deepEqual(titleChanges(MOVIE, draft, SYNCED), expected);
  });

  it("clears an emptied optional field with null", () => {
    const draft = { ...draftOfTitle(MOVIE), plot: " ", year: "", rating: "", cast: "", runtime: "" };
    const expected = { year: null, rating: null, runtimeMs: null, plot: null, cast: null };
    assert.deepEqual(titleChanges(MOVIE, draft, SYNCED), expected);
  });

  it("never sends a synced title's TMDB id; a manual title's goes, null when emptied", () => {
    assert.ok(isEmptyTitleBody(titleChanges(MOVIE, { ...draftOfTitle(MOVIE), tmdbId: "1" }, SYNCED)));
    const manual = { ...MOVIE, state: "manual" as const };
    const cleared = { ...draftOfTitle(manual), tmdbId: "" };
    assert.deepEqual(titleChanges(manual, cleared, { manual: true, series: false }), { tmdbId: null });
  });

  it("sends a manual series' seasons whole, without the episode's season and with its kept fields", () => {
    const draft = draftOfTitle(SERIES);
    const body = titleChanges(SERIES, { ...draft, seasons: addEpisode(addSeason(draft.seasons), 1) }, MANUAL_SERIES);
    assert.deepEqual(body, {
      seasons: [
        { season: 1, episodes: [{ episode: 1, title: "Pilot", airDate: "2020-01-01" }] },
        { season: 2, episodes: [{ episode: 1 }] },
      ],
    });
    assert.deepEqual(titleChanges(SERIES, { ...draft, seasons: [] }, MANUAL_SERIES), { seasons: null });
  });
});
