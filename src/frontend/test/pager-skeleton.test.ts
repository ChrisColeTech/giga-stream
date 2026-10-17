import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LibraryPager } from "@/components/library/LibraryPager";
import { PosterImage } from "@/components/ui/PosterImage";
import { LIBRARY_PAGE_SIZE, SKELETON_ROWS } from "@/lib/library-limits";
import type { Scope } from "@/lib/library-query";
import { pagerSkeletonCount } from "@/lib/pager-skeleton";

const pager = (hasMore: boolean, loading: boolean, view: "grid" | "list" | "rows", scope: Scope = "all") =>
  renderToStaticMarkup(createElement(LibraryPager, { hasMore, loading, view, scope, onVisible: () => false }));
const count = (html: string, needle: string): number => html.split(needle).length - 1;
const CARD = "flex flex-col overflow-hidden rounded-card";

describe("pager skeletons", () => {
  it("counts a page per kind read: All is Movies plus TV, the rest one kind", () => {
    assert.equal(pagerSkeletonCount("grid", "all"), 40);
    assert.equal(pagerSkeletonCount("grid", "movie"), 20);
    assert.equal(pagerSkeletonCount("grid", "tv"), 20);
    assert.equal(pagerSkeletonCount("grid", "local"), 20);
    assert.equal(pagerSkeletonCount("rows", "all"), 40);
  });

  it("caps the list rows", () => {
    assert.equal(pagerSkeletonCount("list", "all"), Math.min(LIBRARY_PAGE_SIZE, SKELETON_ROWS));
    assert.equal(pagerSkeletonCount("list", "movie"), Math.min(LIBRARY_PAGE_SIZE, SKELETON_ROWS));
  });

  it("draws one card skeleton per incoming card while loading", () => {
    assert.equal(count(pager(true, true, "grid", "all"), CARD), 40);
    assert.equal(count(pager(true, true, "grid", "movie"), CARD), 20);
    assert.equal(count(pager(true, true, "grid", "local"), CARD), 20);
    const html = pager(true, true, "grid");
    assert.equal(count(html, "aspect-[2/3]"), 1);
    assert.equal(count(html, "grid-cols-[repeat(auto-fill,minmax(144px,1fr))]"), 1);
  });

  it("draws capped row skeletons in the list", () => {
    assert.equal(count(pager(true, true, "list"), "border-b border-hair"), pagerSkeletonCount("list", "all"));
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
