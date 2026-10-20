import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TitleInfoBody } from "@/components/library/TitleInfoBody";
import { TitleInfoSkeleton } from "@/components/library/TitleInfoSkeleton";
import { TITLE_INFO_SPEC } from "@/components/overlays/TitleInfoWindow";
import { OPEN_SHARE } from "@/constants/child-window";
import type { ResolvedItem } from "@/lib/library-marks";
import type { TitleDetail } from "@/types/title";

const baseItem: ResolvedItem = {
  ref: { kind: "title", id: "movie-1" },
  kind: "movie",
  title: "Catalog title",
  year: 1999,
  posterUrl: "/poster.jpg",
  quality: "1080p",
  genres: ["Drama", "Mystery"],
  favorite: false,
  collectionIds: [],
  collectionSources: {},
};

const movieDetail: TitleDetail = {
  id: "movie-1",
  kind: "movie",
  title: "Catalog title",
  plot: "A short complete plot.",
  rating: 8.2,
  genres: ["Drama", "Mystery"],
  cast: ["A. Actor"],
  runtimeMs: 7_200_000,
};

function draw(item: ResolvedItem, detail: TitleDetail | undefined, detailPending = false): string {
  return renderToStaticMarkup(createElement(TitleInfoBody, { item, detail, detailPending }));
}

function occurrences(value: string, part: string): number {
  return value.split(part).length - 1;
}

describe("Title information's window", () => {
  it("opens 880x620 under the versioned @2 memory key (`50` section 2.7)", () => {
    assert.equal(TITLE_INFO_SPEC.key, "title-info@2", "an old remembered box cannot restore the small size");
    assert.equal(TITLE_INFO_SPEC.width, 880);
    assert.equal(TITLE_INFO_SPEC.body, 620);
  });

  it("stays inside the family's least and the main window's 80% share on first open", () => {
    assert.ok(TITLE_INFO_SPEC.width >= TITLE_INFO_SPEC.minWidth);
    assert.ok(TITLE_INFO_SPEC.body >= TITLE_INFO_SPEC.minBody);
    const main = 1600 * OPEN_SHARE;
    assert.ok(TITLE_INFO_SPEC.width <= main, `880 fits the 80% share of a 1600 room (${main})`);
  });

  it("draws one non-stacking catalog row with fixed 2:3 artwork left of the sole details scroller", () => {
    const html = draw(baseItem, movieDetail);
    assert.equal(occurrences(html, "data-title-info-catalog"), 1);
    assert.equal(occurrences(html, "data-title-info-artwork"), 1);
    assert.equal(occurrences(html, "data-title-info-scroll"), 1);
    assert.ok(html.indexOf("data-title-info-artwork") < html.indexOf("data-title-info-scroll"));
    assert.match(html, /w-\[180px\][^"]*flex-none[^"]*self-start/);
    assert.match(html, /aspect-\[2\/3\]/);
    assert.match(html, /min-h-0[^"]*min-w-0[^"]*flex-1[^"]*overflow-y-auto/);
    assert.doesNotMatch(html, /flex-col[^"]*(?:sm:|md:|lg:)flex-row/);
  });

  it("puts movie facts before the full description without clamping long or short plots", () => {
    const longPlot = `Opening sentence. ${"Complete catalog description. ".repeat(30)}Final sentence.`;
    const longHtml = draw(baseItem, { ...movieDetail, plot: longPlot });
    assert.ok(longHtml.indexOf("Identity") < longHtml.indexOf("Opening sentence."));
    assert.ok(longHtml.indexOf("Runtime") < longHtml.indexOf("Opening sentence."));
    assert.match(longHtml, /Final sentence\./);
    assert.doesNotMatch(longHtml, /line-clamp/);
    assert.match(draw(baseItem, movieDetail), /A short complete plot\./);
    assert.doesNotMatch(draw(baseItem, { ...movieDetail, plot: undefined }), /<p/);
  });

  it("preserves movie, series and local facts while omitting only unavailable detail", () => {
    const seriesItem: ResolvedItem = { ...baseItem, kind: "tv", ref: { kind: "title", id: "tv-2" } };
    const series: TitleDetail = {
      ...movieDetail,
      id: "tv-2",
      kind: "tv",
      runtimeMs: undefined,
      seasons: [{ season: 1, episodeCount: 8 }, { season: 2, episodeCount: 10 }],
    };
    const local: ResolvedItem = {
      ...baseItem,
      ref: { kind: "local", id: "local-3" },
      kind: "local",
      posterUrl: undefined,
      genres: [],
      quality: "4K",
    };
    assert.match(draw(baseItem, movieDetail), /Movie/);
    assert.match(draw(baseItem, movieDetail), /Runtime/);
    assert.match(draw(seriesItem, series), /Series/);
    assert.match(draw(seriesItem, series), /2 seasons · 18 episodes/);
    const localHtml = draw(local, undefined);
    assert.match(localHtml, /Local/);
    assert.match(localHtml, /4K/);
    assert.doesNotMatch(localHtml, /animate-skel-shimmer|<p/);
  });

  it("keeps real and missing artwork in the same fixed frame", () => {
    const present = draw(baseItem, movieDetail);
    const missing = draw({ ...baseItem, posterUrl: undefined }, movieDetail);
    assert.match(present, /<img[^>]*src="\/poster\.jpg"/);
    assert.match(missing, /role="img" aria-label="Catalog title"/);
    assert.match(missing, /w-\[180px\]/);
    assert.match(missing, /aspect-\[2\/3\]/);
  });

  it("uses a matching two-column skeleton rather than generic rows", () => {
    const html = renderToStaticMarkup(createElement(TitleInfoSkeleton));
    assert.equal(occurrences(html, "data-title-info-catalog"), 1);
    assert.equal(occurrences(html, "data-title-info-artwork"), 1);
    assert.equal(occurrences(html, "data-title-info-scroll"), 1);
    assert.match(html, /aspect-\[2\/3\][^"]*w-\[180px\]/);
    assert.doesNotMatch(html, /SkeletonRows|placeholder/i);
  });

  it("preserves actions, shared disabled reasons and hook-owned detail I/O", () => {
    const source = readFileSync("src/components/overlays/TitleInfoWindow.tsx", "utf8");
    assert.match(source, /Favorite/);
    assert.match(source, /Collections/);
    assert.match(source, /Open in Player/);
    assert.match(source, /variant="primary" reason=/);
    assert.match(source, /reason=\{favoriteReason\}/);
    assert.match(source, /reason=\{collectionReason\}/);
    assert.match(source, /useTitleDetail/);
    assert.doesNotMatch(source, /services\/titles|readTitle|disabled=.*title=/);
    assert.match(source, /Workspace[^>]*fill[^>]*!overflow-hidden/);
  });
});
