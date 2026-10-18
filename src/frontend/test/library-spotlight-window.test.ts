import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
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

  it("is not a modal: no scrim, no dialog semantics, no header, no close button, nothing dimmed", () => {
    for (const markup of [draw(OPEN), draw(LISTED), draw(WAITING)]) {
      assert.ok(!markup.includes("data-spotlight-scrim") && !markup.includes("bg-scrim") && !markup.includes("inset-0"));
      assert.ok(!markup.includes('role="dialog"') && !markup.includes("aria-modal"));
      assert.ok(!/<h[1-6][\s>]/.test(markup) && !markup.includes("Close"));
      assert.ok(!markup.includes("opacity-60"), "the window is never dimmed under Title information");
      assert.ok(!PARAGRAPH.test(markup), "no text under a control");
    }
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
