import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BackToTop } from "@/components/library/BackToTop";
import { BackToTopButton } from "@/components/library/BackToTopButton";
import { backToTopBehavior, backToTopVisible } from "@/lib/back-to-top";

describe("back to top visibility", () => {
  it("is absent at the top and within one viewport", () => {
    assert.equal(backToTopVisible(0, 800), false);
    assert.equal(backToTopVisible(800, 800), false);
  });
  it("appears once scrolled past one viewport", () => {
    assert.equal(backToTopVisible(801, 800), true);
    assert.equal(backToTopVisible(12000, 800), true);
  });
  it("never shows for a scroller that has no height yet", () => {
    assert.equal(backToTopVisible(500, 0), false);
  });
  it("scrolls smoothly, or instantly under reduced motion", () => {
    assert.equal(backToTopBehavior(false), "smooth");
    assert.equal(backToTopBehavior(true), "auto");
  });
});

describe("back to top markup", () => {
  it("renders nothing before the list is scrolled (server render has no scroller)", () => {
    assert.equal(renderToStaticMarkup(createElement(BackToTop, { scroller: { current: null } })), "");
  });
  it("is a labelled, focusable button with an up arrow", () => {
    const html = renderToStaticMarkup(createElement(BackToTopButton, { onClick: () => undefined }));
    assert.match(html, /<button[^>]*type="button"[^>]*aria-label="Back to top"/);
    assert.ok(html.includes("lucide-arrow-up"));
    assert.ok(!/\sdisabled(=|\s|>)/.test(html));
  });
});
