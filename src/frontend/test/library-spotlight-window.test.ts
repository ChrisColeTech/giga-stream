import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { pressCatcher, swallowClick } from "@/components/library/SpotlightCatcher";
import { TitleSpotlight } from "@/components/library/TitleSpotlight";
import { SPOTLIGHT_CLOSED, spotlightReducer, type SpotlightAction, type SpotlightState } from "@/lib/spotlight-state";
import type { LibraryItem } from "@/types/library";

const noop = (): void => undefined;
const item = (id: string, kind: "movie" | "tv", year: number): LibraryItem => ({
  ref: { kind: "title", id }, kind, title: `Title ${id}`, year, genres: ["Drama"], rating: 7.25, favorite: false,
});
const run = (...actions: SpotlightAction[]): SpotlightState => actions.reduce(spotlightReducer, SPOTLIGHT_CLOSED);
const ITEMS = [item("a", "movie", 1999), item("b", "tv", 2008), item("c", "movie", 2011)];

const draw = (state: SpotlightState): string =>
  renderToStaticMarkup(createElement(TitleSpotlight, {
    state, dispatch: noop, paused: () => false, onClose: noop, onType: noop, onSubmit: noop, onPlay: noop, onInfo: noop,
  }));

const OPEN = run({ type: "open" });
const LISTED = run({ type: "open" }, { type: "query", query: "ti" }, { type: "results", items: ITEMS });
const WAITING = run({ type: "open" }, { type: "query", query: "ti" }, { type: "searching" });
const PARAGRAPH = /<(p|small)[\s>]/;

describe("the spotlight window", () => {
  it("is only the search bar with nothing typed: no results area, no preview, no placeholder", () => {
    const bar = draw(OPEN);
    assert.ok(bar.includes('role="combobox"'));
    assert.ok(!bar.includes("placeholder"), "no placeholder text");
    assert.ok(!bar.includes("grid-cols"), "no two-column results area");
    assert.ok(!bar.includes("data-preview") && !bar.includes('role="listbox"'));
    assert.ok(bar.includes("rounded-2xl") && bar.includes("w-[760px]") && bar.includes("top-[22%]"));
  });

  it("is not a modal: the window carries no scrim of its own, no dialog semantics, no header, no close button", () => {
    for (const markup of [draw(OPEN), draw(LISTED), draw(WAITING)]) {
      const windowTag = /<div[^>]*data-spotlight="[^"]*"[^>]*>/.exec(markup)?.[0] ?? "";
      assert.ok(!windowTag.includes("bg-scrim"), "the window itself is not washed");
      assert.ok(!markup.includes("data-spotlight-scrim"));
      assert.ok(!markup.includes('role="dialog"') && !markup.includes("aria-modal"));
      assert.ok(!/<h[1-6][\s>]/.test(markup) && !markup.includes("Close"));
      assert.ok(!markup.includes("opacity-60"), "the window is never dimmed under Title information");
      assert.ok(!PARAGRAPH.test(markup), "no text under a control");
    }
  });

  it("its catcher wears the family backdrop: the one scrim, nothing else drawn", () => {
    for (const markup of [draw(OPEN), draw(LISTED), draw(WAITING)]) {
      const catcher = /<div[^>]*data-spotlight-catcher[^>]*>/.exec(markup)?.[0] ?? "";
      assert.ok(catcher.includes("fixed") && catcher.includes("inset-0") && catcher.includes('aria-hidden="true"'));
      assert.ok(catcher.includes("bg-scrim"), "the family backdrop (`50` section 2.6)");
      assert.ok(!/\b(opacity|blur|backdrop|shadow|border)/.test(catcher), "the scrim is the catcher's only wash");
      const layer = (html: string): number => Number(/z-(\d+)/.exec(html)?.[1]);
      const windowTag = /<div[^>]*data-spotlight="[^"]*"[^>]*>/.exec(markup)?.[0] ?? "";
      assert.ok(layer(catcher) < layer(windowTag), "the catcher sits below the window");
      assert.ok(layer(windowTag) < 48, "Title information's scrim (z-48) still washes over both");
      assert.ok(markup.indexOf("data-spotlight-catcher") < markup.indexOf(windowTag));
    }
  });

  it("the backdrop is bg-scrim at z-46 under the panel's z-47 (`50` section 2.6)", () => {
    const markup = draw(OPEN);
    const layer = (html: string): number => Number(/z-(\d+)/.exec(html)?.[1]);
    const catcher = /<div[^>]*data-spotlight-catcher[^>]*>/.exec(markup)?.[0] ?? "";
    const windowTag = /<div[^>]*data-spotlight="[^"]*"[^>]*>/.exec(markup)?.[0] ?? "";
    assert.equal(layer(catcher), 46);
    assert.equal(layer(windowTag), 47);
    assert.ok(catcher.includes("bg-scrim") && !windowTag.includes("bg-scrim"));
  });

  it("closes on a press, ignores it while paused, and the press and click go no further", () => {
    const calls: string[] = [];
    const event = { preventDefault: () => calls.push("prevent"), stopPropagation: () => calls.push("stop") };
    let closed = 0;
    pressCatcher(event, () => false, () => closed++);
    assert.equal(closed, 1);
    assert.deepEqual(calls, ["prevent", "stop"], "the pointerdown never reaches the Library");
    pressCatcher(event, () => true, () => closed++);
    assert.equal(closed, 1, "paused under Title information: the press does nothing");
    calls.length = 0;
    swallowClick(event);
    assert.deepEqual(calls, ["prevent", "stop"], "the click never activates the card under it");
  });

  it("draws the field first, then a hairline and two columns once there is a query", () => {
    const markup = draw(LISTED);
    assert.ok(markup.indexOf("<input") > 0 && markup.indexOf("<input") < markup.indexOf('role="listbox"'));
    assert.ok(markup.includes("grid-cols-[320px_minmax(0,1fr)]") && markup.includes("border-t border-hair"));
    assert.ok(markup.indexOf('role="listbox"') < markup.indexOf("data-preview"), "list left, preview right");
    assert.ok(markup.includes('aria-controls="spotlight-listbox"'));
    assert.ok(markup.includes('aria-activedescendant="spotlight-option-title-a"'));
    assert.equal((markup.match(/aria-label="Play /g) ?? []).length, 3);
    assert.equal((markup.match(/aria-label="Info /g) ?? []).length, 3);
  });

  it("groups the rows under Movies and Series and fills only the focused row with the accent and a chevron", () => {
    const markup = draw(LISTED);
    assert.ok(markup.indexOf("Movies") < markup.indexOf("Series"));
    assert.equal((markup.match(/aria-selected="true"/g) ?? []).length, 1);
    assert.equal((markup.match(/bg-accent text-accent-ink/g) ?? []).length, 1);
    assert.equal((markup.match(/data-chevron/g) ?? []).length, 3, "one chevron per row, shown on the focused one");
    assert.ok(markup.includes(">1999<"));
  });

  it("shows the focused title in the preview pane, informational only", () => {
    const preview = draw(LISTED).slice(draw(LISTED).indexOf("data-preview"));
    assert.ok(preview.includes("Title a") && preview.includes("1999 · Movie") && preview.includes("Drama"));
    assert.ok(preview.includes("7.3 / 10") || preview.includes("7.2 / 10"));
    assert.ok(!preview.includes("<button"), "no buttons in the preview");
  });

  it("is skeletons, never a sentence, while searching: listless rows and a skeleton preview", () => {
    const markup = draw(WAITING);
    assert.ok(markup.includes('aria-busy="true"') && !markup.includes('role="listbox"'));
    assert.ok(markup.includes("aria-hidden") && !markup.includes("data-preview"));
    assert.ok(!markup.includes('aria-expanded="true"'));
    assert.ok(!/>[A-Za-z][^<]*</.test(markup.replace(/<svg[\s\S]*?<\/svg>/g, "")), "no text anywhere");
  });
});
