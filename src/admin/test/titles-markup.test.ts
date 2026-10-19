import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createElement } from "react";
import { START_VIEW } from "@/lib/title-query";
import { TitlesPage } from "@/pages/TitlesPage";
import type { AdminTitleDetail, AdminTitleRow } from "@/services/schemas/title-schema";
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
/** These tests are about the TMDB browse list, so the page is drawn in its `Browse TMDB` view (`Stored` is the default). */
const page = (): string => {
  state().storedSetMode("browse");
  return renderLive(createElement(TitlesPage, { active: true }));
};
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

describe("the list group", () => {
  it("holds one first row (the search with data-search, the Sort select, the Kind select), then the table strip with Newer, Older and Refresh", () => {
    const html = page();
    const row = html.slice(at(html, 'role="search"'));
    assert.ok(at(row, 'aria-label="Search titles"') < at(row, 'aria-label="Sort"'));
    assert.ok(at(row, 'aria-label="Sort"') < at(row, 'aria-label="Kind"'));
    assert.match(html, /<input[^>]*aria-label="Search titles"[^>]*data-search=""/);
    const first = row.slice(0, at(row, 'aria-label="Titles table"'));
    assert.ok(!first.includes("aria-pressed") && !first.includes("Kind filter") && !first.includes("Run the search"));
    for (const sort of ["Newest", "Oldest", "A-Z", "Year", "Trending"]) assert.ok(html.includes(`>${sort}<`), sort);
    assert.ok(html.includes('aria-label="Newer. This is the first page."'));
    assert.ok(html.includes('aria-label="Older. This is the last page."'));
    assert.ok(at(row, 'aria-label="Kind"') < at(row, 'aria-label="Titles table"'));
    assert.ok(at(html, 'title="Refresh titles"') < at(html, 'aria-label="Newer. '), "Refresh first, the paging on the right");
    assert.ok(at(html, 'aria-label="Newer. ') < at(html, 'aria-label="Older. ') && at(html, "Jobs →") < at(html, 'id="ti-list"'));
    const heading = html.slice(at(html, 'id="ti-list"'), at(html, 'aria-label="Search titles"'));
    assert.ok(!heading.includes("Older") && !heading.includes("Refresh"), "no verb in the heading");
  });

  it("shows the Kind select on the one kind the view holds", () => {
    state().titlesSetView({ ...START_VIEW, kinds: ["tv"] });
    const html = page();
    assert.match(html, /<option value="tv" selected="">Series</);
  });

  it("enables Older below the last page", () => {
    loaded([row("movie-1")], 4);
    const html = page();
    assert.ok(!html.includes("This is the last page.") && /<button[^>]*aria-label="Older"[^>]*title="Older"/.test(html));
  });
});

describe("the titles grid", () => {
  it("draws shimmer rows while nothing is read (no TMDB token included), with no sentence", () => {
    state().titlesLoadFailed(START_VIEW, false);
    const html = page();
    assert.ok(html.includes("animate-skel-shimmer") && html.includes("Select all titles"));
    assert.ok(!html.includes("cannot be reached"));
  });

  it("shows the headings and the values; a title TMDB has that the store lacks wears no state word and is not dimmed", () => {
    loaded([row("movie-1", { stored: false, deleted: false }), row("movie-2")]);
    const html = page();
    for (const heading of [">title<", ">kind<", ">year<", ">rating<", ">state<"]) {
      assert.ok(html.includes(heading), heading);
    }
    assert.ok(html.includes(">8.3<") || html.includes(">8.2<"));
    assert.ok(!html.includes("data-st=") && !/<li[^>]*opacity-45/.test(html));
    assert.ok(!html.includes(">Delete</button>"), "Browse rows end in Add, not Delete");
  });
});

describe("the table strip", () => {
  it("leaves the enabled Jobs → to the page toolbar; Add is drawn and waits for a ticked row", () => {
    const html = page();
    const table = html.slice(at(html, 'aria-label="Titles table"'), at(html, 'id="ti-deleted"'));
    const top = html.slice(0, at(html, "overflow-y-auto"));
    const forward = top.match(/<button[^>]*title="Go to Jobs"[^>]*>Jobs →<\/button>/)?.[0] ?? "";
    assert.ok(forward.length > 0 && !forward.includes('disabled=""') && !table.includes("→"));
    assert.ok(table.includes('aria-label="Add. Tick a row first"'));
    for (const verb of ["Enable", "Disable", "Revert to TMDB"]) assert.ok(!table.includes(`aria-label="${verb}.`), verb);
  });
});

describe("a title's workspace", () => {
  const open = (item: AdminTitleRow, detail?: Partial<AdminTitleDetail>): string => {
    loaded([item]);
    state().openWorkspace("titles", item.id);
    if (detail !== undefined) {
      state().titleDetailStart(item.id);
      state().titleDetailLoaded({ ...item, ...detail });
    }
    return page();
  };

  it("wears shimmer lines in its groups until the detail answers, with Discard waiting", () => {
    const html = open(row("tv-1", { kind: "tv", tmdbId: 1399 }));
    assert.ok(html.includes("animate-skel-shimmer") && html.includes(">Seasons<"));
    assert.ok(html.includes('aria-label="Discard changes. Loading."') && !html.includes('aria-label="Title"'));
    assert.ok(at(html, "Discard changes") < at(html, "overflow-y-auto"), "the page toolbar is drawn while the detail loads");
    assert.ok(!html.includes("Jobs →"), "the tab hop is gone (`55` decision 2)");
    assert.ok(!html.includes("Preview →"), "no promote over a skeleton: the detail is not known yet");
    assert.ok(!html.includes("Save details") && !html.includes(">Save<"), "no commit over a skeleton");
  });

  it("a movie: Details, Plot, Images, no Seasons and no Sources; every editable field in order", () => {
    const sources = [{ name: "VidSrc", url: "https://v.test/603" }];
    const html = open(row("movie-1", { tmdbId: 603 }), { plot: "P", runtimeMs: 7_200_000, sources });
    assert.ok(html.includes('aria-label="Title sections"') && !html.includes(">Seasons<"));
    assert.ok(!html.includes(">Sources<") && !html.includes("tw-sources") && !html.includes("v.test/603"));
    assert.ok(at(html, ">Details<") < at(html, ">Plot<") && at(html, ">Plot<") < at(html, ">Images<"));
    const order = ["Title", "Kind", "Year", "Enabled", "TMDB id", "Rating", "Genres", "Runtime", "Stream address"];
    order.push("Plot", "Cast", "Poster address", "Backdrop address");
    for (let i = 1; i < order.length; i += 1) {
      assert.ok(at(html, `aria-label="${order[i - 1]}"`) < at(html, `aria-label="${order[i]}"`), order[i]);
    }
    assert.ok(html.includes('value="120"') && at(html, "Preview →") < at(html, 'id="tw-details"'));
    assert.ok(html.includes('aria-label="Save. Nothing has changed."'), "the commit is the toolbar's Save");
    assert.ok(!html.includes("Save details"), "no trailing save after Images");
    assert.ok(!html.includes("Jobs →"), "the promote replaced the tab hop (`55` decision 2)");
    const bar = html.slice(at(html, 'role="toolbar"'), at(html, 'id="tw-details"'));
    assert.ok(
      at(bar, "Discard changes") < at(bar, "min-w-0 flex-1") &&
        at(bar, "min-w-0 flex-1") < at(bar, ">Save<") &&
        at(bar, ">Save<") < at(bar, "Preview →"),
      "Discard left; Save, then the promote rightmost (`55` decision 2)",
    );
    const promote = html.match(/<button[^>]*title="Preview title"[^>]*>Preview →<\/button>/)?.[0] ?? "";
    assert.ok(promote.length > 0 && !promote.includes('disabled=""'), "the promote is the PromoteButton's shape");
    assert.match(html, /<input[^>]*readOnly=""[^>]*aria-label="Kind"/);
  });

  it("draws no promote for a title without a TMDB id (`55` decision 4)", () => {
    const html = open(row("movie-none"), { plot: "P" });
    assert.ok(!html.includes("Preview →"), "no eye and no promote: no provider source without a TMDB id");
  });

  it("draws the Plot and the Cast as text areas, 4 rows and 3, with their own aria-labels", () => {
    const html = open(row("movie-1"), { plot: "P", cast: ["Ann", "Bo"] });
    assert.match(html, /<textarea[^>]*rows="4"[^>]*aria-label="Plot"/);
    assert.match(html, /<textarea[^>]*rows="3"[^>]*aria-label="Cast"/);
    assert.ok(html.includes(">Ann, Bo</textarea>"), "the cast draft stays text");
    assert.ok(!/<input[^>]*aria-label="Cast"/.test(html), "the Cast row is no single-line field");
  });

  it("disables Revert to TMDB with its reasons: manual, nothing edited; enables it on an edited title", () => {
    const manual = open(row("custom-1", { state: "manual" }), {});
    assert.ok(manual.includes('aria-label="Revert to TMDB. A title made by hand has no TMDB copy to go back to."'));
    assert.ok(open(row("movie-1"), { editedFields: [] }).includes('aria-label="Revert to TMDB. Nothing was edited."'));
    const edited = open(row("movie-2", { state: "edited", editedFields: ["plot"] }), {});
    assert.ok(!edited.includes("Revert to TMDB. ") && edited.includes("Revert to TMDB"));
  });

  it("a manual series edits its seasons; a synced one shows the counts read-only", () => {
    const manual = open(row("custom-2", { kind: "tv", state: "manual" }), {
      seasons: [{ season: 1, episodes: [{ episode: 1, title: "Pilot" }] }],
    });
    assert.ok(manual.includes('aria-label="Season 1 number"') && manual.includes('value="Pilot"'));
    assert.ok(manual.includes("Add season<") && manual.includes("Add episode<"));
    assert.ok(manual.includes('aria-label="Move season 1 up. Already first"'));
    const synced = open(row("tv-9", { kind: "tv" }), { seasons: [{ season: 1, episodeCount: 8 }] });
    assert.ok(synced.includes(">8 episodes<") && !synced.includes("Add season"));
    assert.match(synced, /<input[^>]*readOnly=""[^>]*aria-label="TMDB id"/);
  });

  it("a series ends on Seasons; a movie has no Sources group while loading either", () => {
    const html = open(row("tv-2", { kind: "tv" }), { seasons: [] });
    assert.ok(at(html, ">Images<") < at(html, ">Seasons<") && !html.includes(">Sources<"));
    assert.ok(!open(row("movie-3")).includes(">Sources<"));
  });
});
