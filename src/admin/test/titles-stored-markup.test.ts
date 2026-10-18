import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createElement } from "react";
import { START_STORED, storedKey } from "@/lib/title-stored-query";
import { TitlesPage } from "@/pages/TitlesPage";
import { useAppStore } from "@/store/app-store";
import { renderLive, resetStore, signInForTest } from "./support/store";
import { INVENTORY, titleRowOf } from "./support/titles-stored-kit";

const state = () => useAppStore.getState();
const count = (html: string, needle: string): number => html.split(needle).length - 1;
const at = (html: string, text: string): number => {
  const index = html.indexOf(text);
  assert.ok(index >= 0, `missing: ${text}`);
  return index;
};
/** The page with the stored list holding `total` matching titles, the first `shown` of them loaded. */
function pageWith(total: number, shown = Math.min(total, 100)): string {
  const rows = Array.from({ length: shown }, (_, index) => titleRowOf(`movie-${index}`, index === 1 ? { enabled: false } : {}));
  state().storedPageLoaded(storedKey(START_STORED), 0, {
    rows, total, version: "1:1", inventory: { ...INVENTORY, movie: 5532, tv: 5389 },
  });
  return renderLive(createElement(TitlesPage, { active: true }));
}
const list = (html: string): string => html.slice(at(html, 'id="ti-list"'));

beforeEach(() => {
  resetStore();
  signInForTest();
  state().titlesReset(state().serial);
});

describe("the Stored | Browse TMDB mode", () => {
  it("is a Segmented in a labelled row `View`, Stored lit by default, above the list's first row", () => {
    const html = list(pageWith(5));
    assert.match(html, /<span class="[^"]*"><span class="truncate">View<\/span>/);
    assert.match(html, /aria-label="View"[^>]*>(?:(?!<\/div>).)*aria-pressed="true"[^>]*>Stored</s);
    assert.match(html, /aria-pressed="false"[^>]*>Browse TMDB</);
    assert.ok(at(html, ">View<") < at(html, 'aria-label="Search stored titles"'));
  });

  it("shows the TMDB browse list, with Newer and Older in the strip, once Browse TMDB is chosen", () => {
    state().storedSetMode("browse");
    const html = list(renderLive(createElement(TitlesPage, { active: true })));
    assert.ok(at(html, ">View<") < at(html, 'aria-label="Search titles"'));
    assert.ok(html.includes('aria-label="Newer. This is the first page."') && html.includes('aria-label="Older. This is the last page."'));
    assert.ok(!html.includes('aria-label="Search stored titles"'));
  });
});

describe("the Stored list's first row", () => {
  it("is a search field with its icon, a Sort select and a select each for Kind, Origin, Edited and Enabled, in one wrapping row", () => {
    const html = list(pageWith(5));
    const order = ['aria-label="Search stored titles"', 'aria-label="Sort"', 'aria-label="Kind"', 'aria-label="Origin"', 'aria-label="Edited"', 'aria-label="Enabled"', 'aria-label="Titles table"'];
    order.reduce((previous, needle) => {
      const index = at(html, needle);
      assert.ok(index > previous, needle);
      return index;
    }, -1);
    assert.match(html, /<input[^>]*type="search"[^>]*aria-label="Search stored titles"[^>]*data-search=""/);
    assert.match(html, /flex flex-wrap items-center gap-2/);
    assert.ok(/<select[^>]*aria-label="Sort"/.test(html) && count(html, "<select") === 5);
    for (const label of ["Title, A to Z", "Year, newest", "Rating, highest", "Fetched, newest"]) assert.ok(html.includes(`>${label}<`), label);
    assert.match(html, /<option value="title:asc" selected="">/);
  });

  it("has no chips, no Sort pills and no labelled filter rows", () => {
    const html = list(pageWith(5));
    for (const gone of ['aria-label="Kind filter"', ">Newest<", ">Oldest<", ">Trending<", 'aria-label="Run the search"']) assert.ok(!html.includes(gone), gone);
    assert.equal(count(html, "aria-pressed"), 2, "only the View choice is a pill row");
    for (const label of [">Search<", ">Sort<", ">Kind<", ">Origin<"]) assert.ok(!html.includes(label), `no row labelled ${label}`);
  });

  it("holds no Newer or Older and no sentence: the heading carries the stored count as its badge only", () => {
    const html = list(pageWith(5));
    assert.ok(!html.includes("Newer") && !html.includes("Older") && !/<p[\s>]/.test(html));
    assert.match(html, /tabular-nums">10,921</);
  });

  it("draws the strip as Refresh, Sync now, a hairline, the bulk verbs always (disabled with Tick a row first) and the All box", () => {
    const html = list(pageWith(5));
    const order = ['title="Refresh titles"', ">Sync now<", ">Enable<", ">Disable<", ">Revert to TMDB<", ">Delete<", 'aria-label="Select all titles"'];
    order.reduce((previous, needle) => {
      const index = at(html, needle);
      assert.ok(index > previous, needle);
      return index;
    }, -1);
    assert.ok(html.includes('aria-label="Enable. Tick a row first"') || html.includes("Tick a row first"));
  });
});

describe("the Stored grid", () => {
  it("at or under 100 rows is the plain grid: every row, a disabled one dimmed, no scroller of its own", () => {
    const html = list(pageWith(100));
    assert.equal(count(html, 'aria-label="Select T movie-'), 100);
    assert.ok(!html.includes("aria-rowcount") && !html.includes("data-index"));
    assert.ok(html.includes('aria-label="Stored titles"'));
  });

  it("above 100 rows is windowed: aria-rowcount is the total and only the rows near the top are mounted", () => {
    const html = list(pageWith(5000));
    assert.ok(html.includes('aria-rowcount="5000"'));
    const mounted = count(html, 'aria-label="Select T movie-');
    assert.ok(mounted > 0 && mounted < 40, `${mounted} mounted of 5000`);
  });

  it("draws skeleton rows (never a sentence) while the first page is not read", () => {
    const html = list(renderLive(createElement(TitlesPage, { active: true })));
    assert.ok(count(html, "pointer-events-none grid h-9") > 0 && !html.includes("No titles"));
  });
});
