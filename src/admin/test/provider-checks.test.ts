import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EPISODE_PLACEHOLDERS,
  FRAME_ORIGIN_PATTERN,
  MOVIE_PLACEHOLDERS,
  createReason,
  firstCreateRefusal,
  firstSaveRefusal,
  frameOriginsRefusal,
  originRefusal,
  providerFieldOf,
  templateRefusal,
} from "@/lib/provider-checks";
import { draftOfProvider, EMPTY_NEW_PROVIDER } from "@/lib/provider-draft";
import type { AdminProvider } from "@/services/schemas/provider-schema";

const SAVED: AdminProvider = {
  id: 1,
  name: "Cinezo",
  source: "cinezo",
  is_active: true,
  order: 1,
  family: "embed",
  movieTemplate: "https://c.example.test/movie/{tmdbId}",
  created_at: "2026-10-01T09:00:00.000Z",
};

describe("templates", () => {
  it("need https and {tmdbId}; an empty one passes", () => {
    assert.equal(templateRefusal("Movie template", "", MOVIE_PLACEHOLDERS), null);
    assert.equal(templateRefusal("Movie template", "https://x.test/{tmdbId}", MOVIE_PLACEHOLDERS), null);
    const movie = (value: string) => templateRefusal("Movie template", value, MOVIE_PLACEHOLDERS);
    assert.equal(movie("http://x.test/{tmdbId}"), "Movie template must be an https address.");
    assert.equal(movie("https://x.test/movie"), "Movie template must contain {tmdbId}.");
  });

  it("name every episode placeholder", () => {
    assert.equal(
      templateRefusal("Episode template", "https://x.test/{tmdbId}/{season}", EPISODE_PLACEHOLDERS),
      "Episode template must contain {tmdbId}, {season} and {episode}.",
    );
    const full = "https://x.test/{tmdbId}/{season}/{episode}";
    assert.equal(templateRefusal("Episode template", full, EPISODE_PLACEHOLDERS), null);
  });
});

describe("origins", () => {
  it("are https origins without a path", () => {
    assert.equal(originRefusal(""), null);
    assert.equal(originRefusal("https://p.example.test"), null);
    assert.equal(originRefusal("https://p.example.test:8443/"), null);
    for (const bad of ["http://p.example.test", "https://p.example.test/embed", "nonsense", "https://p.test?x=1"]) {
      assert.equal(originRefusal(bad), "Origin must be an https address with no path.", bad);
    }
  });

  it("allow at most 8 frame origins, each an origin", () => {
    const eight = Array.from({ length: 8 }, (_, i) => `https://f${i}.example.test`);
    assert.equal(frameOriginsRefusal(eight), null);
    assert.equal(frameOriginsRefusal([...eight, "https://nine.example.test"]), "At most 8 frame origins.");
    assert.equal(frameOriginsRefusal(["https://a.test/path"]), "Origin must be an https address with no path.");
  });

  it("chip pattern takes a lower-cased https origin with a port and refuses a path", () => {
    for (const good of ["https://cdn.example.test", "https://a-b.example.test:8443"]) {
      assert.ok(FRAME_ORIGIN_PATTERN.test(good), good);
    }
    for (const bad of ["http://cdn.test", "https://cdn.test/x", "cdn.test", "https://"]) {
      assert.ok(!FRAME_ORIGIN_PATTERN.test(bad), bad);
    }
  });
});

describe("the forms", () => {
  it("disable Create with the first missing field, the Movie template only for an embed provider", () => {
    assert.equal(createReason(EMPTY_NEW_PROVIDER, false, false), "Name is required.");
    assert.equal(createReason({ ...EMPTY_NEW_PROVIDER, name: "A" }, false, false), "Source is required.");
    const named = { ...EMPTY_NEW_PROVIDER, name: "A", source: "a" };
    assert.equal(createReason(named, false, false), "Movie template is required.");
    const stream = { ...EMPTY_NEW_PROVIDER, name: "A", source: "a", family: "stream" as const };
    assert.equal(createReason(stream, false, false), undefined);
    assert.equal(createReason(stream, true, false), "Saving.");
    assert.equal(createReason(stream, false, true), "The admin backend cannot be reached.");
  });

  it("refuse a bad template under its row before sending", () => {
    const draft = { name: "A", family: "embed" as const, source: "a", movieTemplate: "https://x.test/movie" };
    assert.deepEqual(firstCreateRefusal(draft), {
      field: "movieTemplate",
      sentence: "Movie template must contain {tmdbId}.",
    });
    assert.equal(firstCreateRefusal({ ...draft, family: "stream" }), null);
  });

  it("refuse a save in the page's order", () => {
    const draft = draftOfProvider(SAVED);
    assert.equal(firstSaveRefusal(draft), null);
    assert.equal(firstSaveRefusal({ ...draft, name: " " })?.field, "name");
    assert.equal(firstSaveRefusal({ ...draft, origin: "https://o.test/p" })?.field, "origin");
    assert.equal(firstSaveRefusal({ ...draft, episodeTemplate: "https://e.test/{tmdbId}" })?.field, "episodeTemplate");
  });

  it("map a backend field to its row", () => {
    assert.equal(providerFieldOf("frameOrigins.3"), "frameOrigins");
    assert.equal(providerFieldOf("enabled"), "enabled");
    assert.equal(providerFieldOf("body"), undefined);
    assert.equal(providerFieldOf(undefined), undefined);
  });
});
