import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LibraryPager } from "@/components/library/LibraryPager";
import { PosterImage } from "@/components/ui/PosterImage";
import { LIBRARY_PAGE_SIZE, SKELETON_ROWS } from "@/lib/library-limits";
import { pagerSkeletonCount } from "@/lib/pager-skeleton";

const pager = (hasMore: boolean, loading: boolean, view: "grid" | "list" | "rows") =>
  renderToStaticMarkup(createElement(LibraryPager, { hasMore, loading, view, onVisible: () => false }));
const count = (html: string, needle: string): number => html.split(needle).length - 1;

describe("pager skeletons", () => {
  it("counts the page size for cards and caps rows", () => {
    assert.equal(pagerSkeletonCount("grid"), LIBRARY_PAGE_SIZE);
    assert.equal(pagerSkeletonCount("rows"), LIBRARY_PAGE_SIZE);
    assert.equal(pagerSkeletonCount("list"), Math.min(LIBRARY_PAGE_SIZE, SKELETON_ROWS));
  });

  it("draws one card skeleton per incoming card while loading", () => {
    const html = pager(true, true, "grid");
    assert.equal(count(html, "flex flex-col overflow-hidden rounded-card"), LIBRARY_PAGE_SIZE);
    assert.equal(count(html, "aspect-[2/3]"), 1);
    assert.equal(count(html, "grid-cols-[repeat(auto-fill,minmax(144px,1fr))]"), 1);
  });

  it("draws capped row skeletons in the list", () => {
    assert.equal(count(pager(true, true, "list"), "border-b border-hair"), pagerSkeletonCount("list"));
  });

  it("draws nothing when idle with more, and nothing at all at the end", () => {
    assert.equal(count(pager(true, false, "grid"), "rounded-card"), 0);
    assert.equal(pager(false, false, "grid"), "");
  });
});

describe("PosterImage loading", () => {
  it("keeps the tinted tile and starts the image transparent", () => {
    const html = renderToStaticMarkup(createElement(PosterImage, { src: "/p.jpg", alt: "Heat" }));
    assert.match(html, /linear-gradient/);
    assert.match(html, /<img[^>]*opacity:0/);
    assert.doesNotMatch(html, />Heat</);
  });
});
