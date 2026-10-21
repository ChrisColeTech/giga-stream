import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { afterEach, describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { choicePopoverSearches, nextChoiceValues } from "@giga/ui/lib/choice-popover-state";
import { LibraryFilters } from "@/components/library/LibraryFilters";
import { LibraryToolbar } from "@/components/library/LibraryToolbar";
import {
  ALL_MEDIA, MEDIA_OPTIONS, canonicalMedia, mediaChoice, mediaSummary,
} from "@/lib/library-media";
import { DEFAULT_QUERY, type LibraryQuery } from "@/lib/library-query";

const noop = (): void => undefined;
const render = (element: ReturnType<typeof createElement>): string => renderToStaticMarkup(element);
const query = (change: Partial<LibraryQuery> = {}): LibraryQuery => ({ ...DEFAULT_QUERY, ...change });
const choiceCalls = (source: string): string[] => source.match(/<ChoicePopover\b[\s\S]*?\/>/g) ?? [];

describe("Library media choices", () => {
  it("uses derived All transitions and every exact summary", () => {
    assert.deepEqual(canonicalMedia(nextChoiceValues(ALL_MEDIA, "movie", ALL_MEDIA, ALL_MEDIA)), ["movie"]);
    assert.deepEqual(canonicalMedia(nextChoiceValues(["movie"], "tv", ALL_MEDIA, ALL_MEDIA)), ["movie", "tv"]);
    assert.deepEqual(canonicalMedia(nextChoiceValues(["movie", "tv"], "local", ALL_MEDIA, ALL_MEDIA)), ALL_MEDIA);
    assert.deepEqual(canonicalMedia(nextChoiceValues(["movie"], "movie", ALL_MEDIA, ALL_MEDIA)), ALL_MEDIA);
    const summaries = [
      [ALL_MEDIA, "All"], [["movie"], "Movies"], [["tv"], "TV"], [["local"], "Local"],
      [["movie", "tv"], "Movies + TV"], [["movie", "local"], "Movies + Local"],
      [["tv", "local"], "TV + Local"],
    ] as const;
    for (const [scope, summary] of summaries) assert.equal(mediaSummary(scope), summary);
  });

  it("gives toolbar and pane the same options and state helper", () => {
    const toolbar = mediaChoice(["movie", "local"], noop);
    const pane = mediaChoice(["movie", "local"], noop);
    assert.equal(toolbar.options, MEDIA_OPTIONS);
    assert.equal(pane.options, MEDIA_OPTIONS);
    assert.deepEqual(toolbar.values, pane.values);
    assert.equal(toolbar.summary, "Movies + Local");
  });
});

describe("Library composition", () => {
  it("renders the exact toolbar controls in order and no rejected controls or tokens", () => {
    const markup = render(createElement(LibraryToolbar, {
      query: query({ scope: ["movie", "tv"] }), view: "list", loading: false,
      onQuery: noop, onView: noop, onRefresh: noop, onSearch: noop,
    }));
    const positions = ["Media: Movies + TV", "View: List", "Refresh Library", "Search titles"]
      .map((label) => markup.indexOf(label));
    assert.ok(positions.every((position) => position >= 0));
    assert.deepEqual([...positions].sort((a, b) => a - b), positions);
    for (const rejected of ["Filters ·", "Sort:", "Applied filters", "PopupPanel"]) {
      assert.equal(markup.includes(rejected), false, rejected);
    }
  });

  it("renders the full pane in exact order, with Sort and no View", () => {
    const markup = render(createElement(LibraryFilters, {
      query: query({ scope: ["local"], genres: ["Drama"], year: "2020", watched: "watching" }),
      genres: ["Action", "Drama"], years: [2024, 2020], trending: true, onQuery: noop,
    }));
    const labels = ["Title", "Media", "Genre", "Year", "Watched", "Sort", "Clear filters"];
    const positions = labels.map((label) => markup.indexOf(`>${label}<`));
    assert.ok(positions.every((position) => position >= 0));
    assert.deepEqual([...positions].sort((a, b) => a - b), positions);
    assert.equal(markup.includes("View:"), false);
  });

  it("uses automatic shared search for Genre at twelve and keeps View icons", () => {
    assert.equal(choicePopoverSearches(11), false);
    assert.equal(choicePopoverSearches(12), true);
    const toolbar = readFileSync("src/components/library/LibraryToolbar.tsx", "utf8");
    const filters = readFileSync("src/components/library/LibraryFilters.tsx", "utf8");
    const calls = [...choiceCalls(toolbar), ...choiceCalls(filters)];
    assert.match(toolbar, /LayoutGrid.*List.*Rows3/s);
    assert.equal(choiceCalls(toolbar).length, 2);
    assert.equal(choiceCalls(filters).length, 5);
    assert.ok(calls.some((call) => call.includes("mediaChoice")));
    assert.ok(calls.some((call) => call.includes('mode="multi" label="Genre"')));
    for (const call of calls) {
      assert.doesNotMatch(call, /\b(?:searchThreshold|className|width|minWidth)\s*=/);
    }
  });

  it("deletes every rejected frontend choice implementation", () => {
    for (const path of [
      "src/components/ui/ChoiceMenu.tsx", "src/components/ui/ChoicePicker.tsx",
      "src/components/library/GenrePopover.tsx", "src/components/library/AppliedFilters.tsx",
      "src/lib/library-filter-state.ts",
    ]) assert.equal(existsSync(path), false, path);
  });
});

describe("the Library watched filter control (`63` section 3.3)", () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "window");
  });

  it("is visibly disabled signed out, with the session's reason as its tooltip", () => {
    /* SSR renders the store's initial snapshot (zustand v5 serves getInitialState on the server), which is the
       signed-out cell: no watch is tracked on any runtime, so the control says why. */
    (globalThis as { window?: unknown }).window = {};
    const markup = render(createElement(LibraryFilters, {
      query: query(), genres: ["Action"], years: [2024], trending: false, onQuery: noop,
    }));
    assert.match(markup, /The watched filter needs a session&#x27;s watch history\./);
    assert.match(markup, /disabled/);
  });

  it("keeps no word of the `61` runtime fork: the reason is the session's on the desktop too", () => {
    (globalThis as { window?: unknown }).window = { pocHost: { runtime: "electron" } };
    const markup = render(createElement(LibraryFilters, {
      query: query(), genres: ["Action"], years: [2024], trending: false, onQuery: noop,
    }));
    assert.equal(markup.includes("desktop library"), false);
    assert.match(markup, /The watched filter needs a session&#x27;s watch history\./);
  });
});
