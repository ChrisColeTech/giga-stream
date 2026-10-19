import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppliedFilters } from "@/components/library/AppliedFilters";
import { LibraryFilters } from "@/components/library/LibraryFilters";
import { LibraryToolbar } from "@/components/library/LibraryToolbar";
import { appliedFilters } from "@/lib/library-filter-state";
import { DEFAULT_QUERY, type LibraryQuery } from "@/lib/library-query";

const noop = (): void => undefined;
const render = (element: ReturnType<typeof createElement>): string => renderToStaticMarkup(element);
const query = (change: Partial<LibraryQuery> = {}): LibraryQuery => ({ ...DEFAULT_QUERY, ...change });

describe("faceted filter state", () => {
  it("counts and removes every non-default value as an applied state token", () => {
    const current = query({ search: "heat", scope: "movie", genres: ["Crime", "Drama"], year: "1995", watched: "watched" });
    const filters = appliedFilters(current);
    assert.equal(filters.length, 6);
    assert.deepEqual(filters.map((filter) => filter.label), [
      "Title: heat", "Media: Movies", "Genre: Crime", "Genre: Drama", "Year: 1995", "Watched: Watched",
    ]);
    const markup = render(createElement(AppliedFilters, { query: current, onQuery: noop }));
    assert.equal((markup.match(/aria-label="Remove /g) ?? []).length, 6);
  });

  it("renders the toolbar count plus Sort and View menu buttons", () => {
    const current = query({ scope: "tv", genres: ["Drama"] });
    const markup = render(createElement(LibraryToolbar, {
      query: current, view: "list", trending: false, filters: createElement("div"), loading: false,
      onQuery: noop, onView: noop, onRefresh: noop, onSearch: noop,
    }));
    assert.match(markup, /Filters · 2<\/button>/);
    assert.match(markup, /aria-label="Sort: Newest"/);
    assert.ok(markup.includes("Sort: Newest"));
    assert.match(markup, /aria-label="View: List"/);
    assert.ok(markup.includes("View: List"));
    assert.match(markup, /aria-label="Refresh Library".*aria-label="Search titles"/s);
  });
});

describe("wide and compact filter composition", () => {
  it("renders the same query and option sources in either host", () => {
    const props = {
      query: query({ scope: "local", genres: ["Drama"], year: "2020", watched: "watching" }),
      genres: ["Action", "Drama"], years: [2024, 2020], onQuery: noop,
    };
    const wide = render(createElement(LibraryFilters, props));
    const compact = render(createElement(LibraryFilters, props));
    assert.equal(compact, wide);
    for (const label of ["Title", "Media", "Genre", "Year", "Watched", "Clear filters"]) {
      assert.ok(wide.includes(label), label);
    }
  });

  it("uses checklist rows for Genre with search at twelve and no pressed chip cloud", () => {
    const source = readFileSync("src/components/library/GenrePopover.tsx", "utf8");
    assert.match(source, /SEARCH_MIN_GENRES/);
    assert.match(source, /Menu\.CheckboxItem/);
    assert.match(source, /Search genres/);
    assert.doesNotMatch(source, /aria-pressed|rounded-full/);
    assert.match(source, /onOpenChange/);
  });

  it("uses radio menu rows for single pickers and sort/view, including view icons", () => {
    const picker = readFileSync("src/components/ui/ChoicePicker.tsx", "utf8");
    const menu = readFileSync("src/components/ui/ChoiceMenu.tsx", "utf8");
    const toolbar = readFileSync("src/components/library/LibraryToolbar.tsx", "utf8");
    assert.match(picker, /Menu\.RadioGroup/);
    assert.match(picker, /event\.key !== "Escape"/);
    assert.match(menu, /Menu\.RadioItem/);
    assert.match(toolbar, /LayoutGrid.*List.*Rows3/s);
  });
});
