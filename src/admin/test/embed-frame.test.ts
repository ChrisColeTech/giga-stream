import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EMBED_ALLOW, embedTargetOf, fillTemplate, stopEmbedFrame } from "@/lib/embed-frame";
import type { AdminProvider } from "@/services/schemas/provider-schema";

/* The admin's embed lib (`55` decisions 7 and 8): the backend's fill rule mirrored, the frame rules the interface's
 * embed host follows. */

const provider = (extra: Partial<AdminProvider> = {}): AdminProvider => ({
  id: 1,
  name: "VidSrc",
  source: "vidsrc",
  is_active: true,
  order: 1,
  family: "embed",
  movieTemplate: "https://vidsrc.sh/embed/movie/{tmdbId}",
  origin: "https://vidsrc.sh",
  frameOrigins: ["https://vidsrc.sh"],
  created_at: "2026-10-01T09:00:00.000Z",
  ...extra,
});

describe("the fill rule, mirrored from the backend", () => {
  it("fills {tmdbId}, {season} and {episode} only", () => {
    assert.equal(fillTemplate("https://v.test/movie/{tmdbId}", { tmdbId: 603 }), "https://v.test/movie/603");
    assert.equal(
      fillTemplate("https://v.test/tv/{tmdbId}/{season}/{episode}", { tmdbId: 1399, season: 1, episode: 2 }),
      "https://v.test/tv/1399/1/2",
    );
  });

  it("keeps a placeholder with no value literal, and leaves no other placeholder alone", () => {
    assert.equal(fillTemplate("https://v.test/movie/{tmdbId}", {}), "https://v.test/movie/{tmdbId}");
    assert.equal(
      fillTemplate("https://v.test/tv/{tmdbId}/{season}/{episode}", { tmdbId: 1399 }),
      "https://v.test/tv/1399/{season}/{episode}",
    );
    assert.equal(fillTemplate("https://v.test/{imdbId}/{anything}", { tmdbId: 603 }), "https://v.test/{imdbId}/{anything}");
  });
});

describe("one movie's embed target", () => {
  it("fills the provider's movie template with the title's TMDB id", () => {
    assert.deepEqual(embedTargetOf(provider({ frameOrigins: undefined }), 603), {
      address: "https://vidsrc.sh/embed/movie/603",
      origin: "https://vidsrc.sh",
      frameOrigins: [],
    });
  });

  it("carries the provider's frame origins for the window's policy", () => {
    const target = embedTargetOf(provider({ frameOrigins: ["https://vidsrc.sh", "https://cdn.v.test"] }), 603);
    assert.deepEqual(target?.frameOrigins, ["https://vidsrc.sh", "https://cdn.v.test"]);
  });

  it("falls back to the filled address's own origin when the provider names none", () => {
    const target = embedTargetOf(provider({ origin: undefined }), 603);
    assert.equal(target?.origin, "https://vidsrc.sh");
    assert.equal(embedTargetOf(provider({ origin: undefined, movieTemplate: "https://player.v.test/movie/{tmdbId}" }), 603)
      ?.origin, "https://player.v.test");
  });

  it("is null when there is nothing to embed: a stream family, no template, no TMDB id, or not https", () => {
    assert.equal(embedTargetOf(provider({ family: "stream" }), 603), null);
    assert.equal(embedTargetOf(provider({ movieTemplate: undefined }), 603), null);
    assert.equal(embedTargetOf(provider(), undefined), null);
    assert.equal(embedTargetOf(provider({ movieTemplate: "http://v.test/movie/{tmdbId}" }), 603), null);
    assert.equal(embedTargetOf(provider({ origin: undefined, movieTemplate: "v.test/movie/{tmdbId}" }), 603), null);
  });
});

describe("the frame rules the interface's embed host follows", () => {
  it("allows the autoplay permissions, and no sandbox attribute exists in this lib", () => {
    assert.equal(EMBED_ALLOW, "autoplay; fullscreen; encrypted-media; picture-in-picture");
    assert.equal(EMBED_ALLOW.includes("sandbox"), false);
  });

  it("blanks the frame so picture and sound stop at once, and does nothing with no frame", () => {
    const frame = { src: "https://vidsrc.sh/embed/movie/603" };
    stopEmbedFrame(frame);
    assert.equal(frame.src, "about:blank");
    stopEmbedFrame(null);
    stopEmbedFrame(undefined);
  });
});