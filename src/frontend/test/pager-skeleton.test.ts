import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LibraryPager } from "@/components/library/LibraryPager";
import { PosterImage } from "@/components/ui/PosterImage";
import { LIBRARY_PAGE_SIZE, SKELETON_ROWS } from "@/lib/library-limits";
import { ALL_MEDIA, type MediaScope } from "@/lib/library-media";
import { pagerSkeletonCount } from "@/lib/pager-skeleton";

const pager = (hasMore: boolean, loading: boolean, view: "grid" | "list" | "rows", scope: MediaScope = ALL_MEDIA) =>
  renderToStaticMarkup(createElement(LibraryPager, { hasMore, loading, view, scope, onVisible: () => false }));
const count = (html: string, needle: string): number => html.split(needle).length - 1;
const CARD = "flex flex-col overflow-hidden rounded-card";

describe("pager skeletons", () => {
  it("counts one mixed-kind server page for every media combination", () => {
    assert.equal(pagerSkeletonCount("grid", ALL_MEDIA), 20);
    assert.equal(pagerSkeletonCount("grid", ["movie"]), 20);
    assert.equal(pagerSkeletonCount("grid", ["tv", "local"]), 20);
    assert.equal(pagerSkeletonCount("rows", ALL_MEDIA), 20);
  });

  it("caps the list rows", () => {
    assert.equal(pagerSkeletonCount("list", ALL_MEDIA), Math.min(LIBRARY_PAGE_SIZE, SKELETON_ROWS));
    assert.equal(pagerSkeletonCount("list", ["movie", "local"]), Math.min(LIBRARY_PAGE_SIZE, SKELETON_ROWS));
  });

  it("draws one card skeleton per incoming card while loading", () => {
    assert.equal(count(pager(true, true, "grid", ALL_MEDIA), CARD), 20);
    assert.equal(count(pager(true, true, "grid", ["movie"]), CARD), 20);
    assert.equal(count(pager(true, true, "grid", ["movie", "local"]), CARD), 20);
    const html = pager(true, true, "grid");
    assert.equal(count(html, "aspect-[2/3]"), 1);
    assert.equal(count(html, "grid-cols-[repeat(auto-fill,minmax(144px,1fr))]"), 1);
  });

  it("draws capped row skeletons in the list", () => {
    assert.equal(count(pager(true, true, "list"), "border-b border-hair"), pagerSkeletonCount("list", ALL_MEDIA));
  });

  it("draws nothing when idle with more, and nothing at all at the end", () => {
    assert.equal(count(pager(true, false, "grid"), "rounded-card"), 0);
    assert.equal(pager(false, false, "grid"), "");
  });
});

describe("PosterImage loading", () => {
  it("shows the shimmer, no accent tint, and starts the image transparent", () => {
    const html = renderToStaticMarkup(createElement(PosterImage, { src: "/p.jpg", alt: "Heat" }));
    assert.match(html, /animate-skel-shimmer/);
    assert.doesNotMatch(html, /linear-gradient\(170deg|color-mix|--color-accent|--color-tone/);
    assert.match(html, /<img[^>]*opacity:0/);
    assert.doesNotMatch(html, />Heat</);
  });

  it("keeps the tint and the title for a title with no poster", () => {
    for (const src of [undefined, ""]) {
      const html = renderToStaticMarkup(createElement(PosterImage, { src, alt: "Heat" }));
      assert.match(html, /linear-gradient\(170deg/);
      assert.match(html, />Heat</);
      assert.doesNotMatch(html, /animate-skel-shimmer/);
    }
  });
});
