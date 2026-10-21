import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { on } from "@giga/ui/lib/bus";
import type { MenuItem } from "@giga/ui/menus/types";
import { CategoriesSection, categoryQuery, categorySelected } from "@/components/library/CategoriesSection";
import { CollectionsSection } from "@/components/library/CollectionsSection";
import { LIBRARY_SECTION_KEYS, librarySectionState } from "@/components/library/library-section-state";
import { openCollectionMenu } from "@/components/library/rail-menu";
import { LibraryRail } from "@/components/library/LibraryRail";
import { DEFAULT_QUERY, type LibraryQuery } from "@/lib/library-query";
import { useAppStore } from "@/store/app-store";

const noop = (): void => undefined;
const query = (change: Partial<LibraryQuery> = {}): LibraryQuery => ({ ...DEFAULT_QUERY, ...change });
const button = (html: string, label: string): string => {
  const match = html.match(/<button[^>]*>.*?<\/button>/g)?.find((row) => row.includes(`>${label}</span>`));
  assert.ok(match, `${label} row is present`);
  return match;
};

beforeEach(() => useAppStore.setState(useAppStore.getInitialState(), true));
afterEach(() => useAppStore.setState(useAppStore.getInitialState(), true));

const rail = (signedIn = true): string => renderToStaticMarkup(createElement(LibraryRail, {
  query: DEFAULT_QUERY, signedIn, counts: { collections: {} }, collections: [], genres: ["Drama"], onQuery: noop,
}));

describe("Library rail sections", () => {
  it("uses the shared Section and not NavGroup for both groups", () => {
    for (const file of ["CategoriesSection.tsx", "CollectionsSection.tsx"]) {
      const source = readFileSync(`src/components/library/${file}`, "utf8");
      assert.match(source, /@giga\/ui\/lists\/Section/);
      assert.doesNotMatch(source, /NavGroup/);
    }
  });

  it("renders both shared disclosures expanded from the initial server snapshot", () => {
    const initial = rail();
    assert.match(button(initial, "Categories"), /aria-expanded="true"/);
    assert.match(button(initial, "Collections"), /aria-expanded="true"/);
  });

  it("derives independent fold state and binds each toggle to its stable key", () => {
    assert.deepEqual(LIBRARY_SECTION_KEYS, {
      categories: "library.categories", collections: "library.collections",
    });
    let toggled = "";
    const categories = librarySectionState({}, LIBRARY_SECTION_KEYS.categories, (key) => { toggled = key; });
    assert.equal(categories.open, true);
    categories.onToggle();
    assert.equal(toggled, LIBRARY_SECTION_KEYS.categories);

    const folded = { [LIBRARY_SECTION_KEYS.categories]: true };
    assert.equal(librarySectionState(folded, LIBRARY_SECTION_KEYS.categories, noop).open, false);
    assert.equal(librarySectionState(folded, LIBRARY_SECTION_KEYS.collections, noop).open, true);

    useAppStore.getState().toggleFold(LIBRARY_SECTION_KEYS.categories);
    useAppStore.getState().setSurface("live");
    useAppStore.getState().setSurface("library");
    assert.equal(useAppStore.getState().folded[LIBRARY_SECTION_KEYS.categories], true);
    assert.equal(useAppStore.getState().folded[LIBRARY_SECTION_KEYS.collections], undefined);
  });

  it("bounds the accordion like Live so both headings and the pinned footer stay reachable", () => {
    const html = rail();
    assert.match(html, /<nav[^>]*><div class="flex min-h-0 flex-1 flex-col overflow-hidden">/);
    assert.ok(html.indexOf("Categories") < html.indexOf("Collections"));
    assert.ok(html.indexOf("</nav>") < html.indexOf("Manage collections"));
  });
});

describe("Library rail categories", () => {
  it("applies the exact query patches for All, History and a genre", () => {
    assert.deepEqual(categoryQuery("all"), { source: "all", genres: [] });
    assert.deepEqual(categoryQuery("history"), { source: "history" });
    assert.deepEqual(categoryQuery({ genre: "Drama" }), { source: "all", genres: ["Drama"] });
  });

  it("selects only All or one exact genre under the All source", () => {
    assert.equal(categorySelected(query(), "all"), true);
    assert.equal(categorySelected(query({ source: "favorites" }), "all"), false);
    assert.equal(categorySelected(query({ genres: ["Drama"] }), { genre: "Drama" }), true);
    assert.equal(categorySelected(query({ genres: ["Drama", "Crime"] }), { genre: "Drama" }), false);
    assert.equal(categorySelected(query({ source: "history", genres: ["Drama"] }), { genre: "Drama" }), false);
  });

  it("orders All, History and facets, selecting the exact row without genre counts", () => {
    const html = renderToStaticMarkup(createElement(CategoriesSection, {
      query: query({ genres: ["Drama"] }), signedIn: true, genres: ["Drama", "Crime"],
      counts: { all: 42, history: 7, collections: {} }, onQuery: noop,
    }));
    assert.ok(html.indexOf("All") < html.indexOf("History"));
    assert.ok(html.indexOf("History") < html.indexOf("Drama"));
    assert.ok(html.indexOf("Drama") < html.indexOf("Crime"));
    assert.match(button(html, "Drama"), /aria-current="page"/);
    assert.doesNotMatch(button(html, "All"), /aria-current="page"/);
    assert.doesNotMatch(button(html, "Drama"), />42<|>7</);
    assert.doesNotMatch(button(html, "Crime"), />42<|>7</);
  });
});

describe("Library rail collections", () => {
  it("puts Favorites before alphabetical user collections with only its existing count", () => {
    const html = renderToStaticMarkup(createElement(CollectionsSection, {
      source: "favorites", counts: { favorites: 9, collections: { a: 2, z: 3 } }, onSource: noop,
      collections: [
        { id: "z", name: "Zed", type: "movie", total: 3, manual: 3, folders: 0, scan: "idle" },
        { id: "a", name: "Alpha", type: "movie", total: 2, manual: 2, folders: 0, scan: "idle" },
      ],
    }));
    assert.ok(html.indexOf("Favorites") < html.indexOf("Alpha"));
    assert.ok(html.indexOf("Alpha") < html.indexOf("Zed"));
    assert.match(button(html, "Favorites"), /aria-current="page"/);
    assert.match(button(html, "Favorites"), />9</);
  });

  it("retains the user collection context actions", () => {
    const rows: MenuItem[] = [];
    const stop = on("menu:open", (payload) => rows.push(...(payload as { items: MenuItem[] }).items));
    try {
      openCollectionMenu({ clientX: 1, clientY: 1, preventDefault: noop, stopPropagation: noop }, noop, noop);
    } finally {
      stop();
    }
    assert.deepEqual(rows.map((row) => row.kind === "action" ? row.label : row.kind), [
      "Attach folder…", "separator", "Rename…", "Remove…",
    ]);
  });
});
