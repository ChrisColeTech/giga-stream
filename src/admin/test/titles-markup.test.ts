import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createElement } from "react";
import { START_VIEW } from "@/lib/title-query";
import { TitlesPage } from "@/pages/TitlesPage";
import type { AdminTitleRow } from "@/services/schemas/title-schema";
import { useAppStore } from "@/store/app-store";
import { renderLive, resetStore, signInForTest } from "./support/store";

const state = () => useAppStore.getState();
const row = (id: string, extra: Partial<AdminTitleRow> = {}): AdminTitleRow => ({
  id,
  kind: "movie",
  title: `T ${id}`,
  year: 1999,
  rating: 8.25,
  state: "synced",
  enabled: true,
  ...extra,
});
const page = (): string => renderLive(createElement(TitlesPage, { active: true }));
const at = (html: string, text: string): number => {
  const index = html.indexOf(text);
  assert.ok(index >= 0, `missing: ${text}`);
  return index;
};
const loaded = (items: AdminTitleRow[], totalPages = 1): void => {
  state().titlesReset(state().serial);
  state().titlesLoaded(START_VIEW, { items, page: 1, totalPages, totalResults: items.length });
};

beforeEach(() => {
  resetStore();
  signInForTest();
});

describe("the New title form", () => {
  it("has Title, Kind and Year in that order; Kind is Movie or Series; Create says what is missing", () => {
    const html = page();
    assert.ok(at(html, 'aria-label="Title"') < at(html, 'aria-label="Kind"'));
    assert.ok(at(html, 'aria-label="Kind"') < at(html, 'aria-label="Year"'));
    assert.match(html, /aria-pressed="true"[^>]*>Movie</);
    assert.ok(html.includes('aria-label="Create. Title is required."') && !html.includes('placeholder="'));
  });
});

describe("the list heading", () => {
  it("holds the search with data-search, the Kind chips, the Sort pills, then Older, Newer and Refresh", () => {
    const html = page();
    assert.ok(at(html, 'aria-label="Search titles"') < at(html, 'aria-label="Kind filter"'));
    assert.ok(at(html, 'aria-label="Kind filter"') < at(html, 'aria-label="Sort"'));
    assert.match(html, /<input[^>]*aria-label="Search titles"[^>]*data-search=""/);
    assert.ok(html.includes('aria-label="Run the search"'));
    for (const sort of ["Newest", "Oldest", "A-Z", "Year", "Trending"]) assert.ok(html.includes(`>${sort}<`), sort);
    assert.ok(html.includes('aria-label="Newer. This is the first page."'));
    assert.ok(html.includes('aria-label="Older. This is the last page."'));
  });

  it("locks the last lit kind chip with its reason", () => {
    state().titlesSetView({ ...START_VIEW, kinds: ["tv"] });
    assert.match(page(), /<button[^>]*aria-pressed="true"[^>]*disabled=""[^>]*title="At least 1 must stay on\."[^>]*>Series</);
  });

  it("enables Older below the last page", () => {
    loaded([row("movie-1")], 4);
    const html = page();
    assert.ok(!html.includes("This is the last page.") && html.includes(">Older<"));
  });
});

describe("the titles grid", () => {
  it("draws shimmer rows while nothing is read (no TMDB token included), with no sentence", () => {
    state().titlesLoadFailed(START_VIEW, false);
    const html = page();
    assert.ok(html.includes("animate-skel-shimmer") && html.includes("Select all titles"));
    assert.ok(!html.includes("cannot be reached"));
  });

  it("shows the headings, the state words, a dimmed disabled row, and the delete tips", () => {
    loaded([
      row("movie-1"),
      row("movie-2", { state: "edited", editedFields: ["plot", "cast"] }),
      row("custom-1", { state: "manual" }),
      row("movie-3", { enabled: false }),
    ]);
    const html = page();
    for (const heading of [">title<", ">kind<", ">year<", ">rating<", ">state<"]) assert.ok(html.includes(heading), heading);
    for (const word of ["synced", "edited", "manual", "disabled"]) assert.ok(html.includes(`data-st="${word}"`), word);
    assert.ok(html.includes(">8.3<") || html.includes(">8.2<"));
    assert.ok(html.includes("opacity-45"));
    assert.ok(html.includes('title="Deletes the title made here."'));
    assert.ok(html.includes("the next catalog sync or browse that lists it adds it again. Turn Enabled off to keep it hidden."));
  });
});

describe("the toolbar", () => {
  it("draws Enable, Disable, Revert to TMDB and Delete, disabled until a row is ticked, beside Jobs →", () => {
    const html = page();
    for (const verb of ["Enable", "Disable", "Revert to TMDB"]) assert.ok(html.includes(`aria-label="${verb}. Tick a row first"`), verb);
    assert.match(html, /<button[^>]*disabled=""[^>]*title="Tick a row first"[^>]*>Delete</);
    const forward = html.match(/<button[^>]*>Jobs →/)?.[0] ?? "";
    assert.ok(forward.length > 0 && !forward.includes('disabled=""'));
  });

  it("refuses Revert to TMDB on a ticked manual title with its reason", () => {
    loaded([row("custom-1", { state: "manual" })]);
    state().titleTick("custom-1", true);
    assert.ok(page().includes('aria-label="Revert to TMDB. A title made by hand has no TMDB copy to go back to."'));
  });
});
