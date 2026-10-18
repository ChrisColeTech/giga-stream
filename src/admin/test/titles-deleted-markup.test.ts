// The Deleted titles group on the Titles page (`37` section 4.4), rendered from the store: shimmer rows as the empty
// state, the name first, a Restore per row and a bulk Restore with its reasons.
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createElement } from "react";
import { TitlesPage } from "@/pages/TitlesPage";
import type { AdminDeletedTitle } from "@/services/schemas/title-schema";
import { useAppStore } from "@/store/app-store";
import { renderLive, resetStore, signInForTest } from "./support/store";

const state = () => useAppStore.getState();
const gone = (id: string, title?: string): AdminDeletedTitle => ({
  id,
  kind: id.startsWith("tv") ? "tv" : "movie",
  tmdbId: Number(id.split("-")[1]),
  ...(title !== undefined && { title }),
  deletedAt: Date.UTC(2026, 9, 17, 12),
});
const page = (): string => renderLive(createElement(TitlesPage, { active: true }));
const group = (html: string): string => {
  const start = html.indexOf('id="ti-deleted"');
  assert.ok(start >= 0, "the Deleted titles group is on the page");
  return html.slice(start);
};

beforeEach(() => {
  resetStore();
  signInForTest();
  state().titlesReset(state().serial);
});

describe("the Deleted titles group", () => {
  it("follows the Titles list under its own heading, with shimmer rows and no sentence while nothing is listed", () => {
    const html = page();
    assert.ok(html.indexOf('id="ti-list"') < html.indexOf('id="ti-deleted"'));
    const deleted = group(html);
    assert.ok(deleted.includes(">Deleted titles<") && deleted.includes("Select all deleted titles"));
    assert.ok(deleted.includes("animate-skel-shimmer"));
    assert.ok(!deleted.includes("No deleted") && !deleted.includes("Nothing"));
  });

  it("lists the name first, then the kind and when, and ends every row with its own Restore", () => {
    state().titlesDeletedLoaded([gone("movie-603", "The Matrix"), gone("tv-1399")]);
    const deleted = group(page());
    const heads = [">name<", ">kind<", ">deleted<"].map((head) => deleted.indexOf(head));
    assert.ok(heads.every((at) => at >= 0) && (heads[0] ?? 0) < (heads[1] ?? 0) && (heads[1] ?? 0) < (heads[2] ?? 0));
    assert.ok(deleted.indexOf(">The Matrix<") < deleted.indexOf(">Movie<"), "the name comes before the kind");
    assert.ok(deleted.includes(">tv-1399<"), "a title with no kept text is named by its id");
    assert.ok(deleted.includes(">2026-10-"), "the day it was deleted");
    assert.equal(deleted.match(/>Restore</g)?.length, 2, "one per row; the bulk verb is an icon in the strip, once ticked");
    assert.ok(deleted.includes('aria-label="Refresh deleted titles"'), "Refresh is the strip's");
    assert.ok(!deleted.slice(0, deleted.indexOf('role="toolbar"')).includes("<button type=\"button\" class=\"inline-flex h-ctl-sm"));
    assert.ok(deleted.includes('title="Lets the title return on the next browse or sync."'));
    assert.ok(!deleted.includes("animate-skel-shimmer"));
  });

  it("draws the bulk Restore as an icon in the strip only once a row is ticked, with the count", () => {
    state().titlesDeletedLoaded([gone("movie-603", "The Matrix")]);
    const strip = (html: string): string => html.slice(html.indexOf('aria-label="Deleted titles table"'));
    assert.ok(!strip(group(page())).includes('aria-label="Restore"'));
    state().titleDeletedTick("movie-603", true);
    const ticked = group(page());
    assert.ok(/<button[^>]*aria-label="Restore"[^>]*title="Restore"/.test(strip(ticked)));
    assert.ok(strip(ticked).includes("selected"));
    assert.match(ticked, /<li[^>]*data-ticked=""/);
  });

  it("disables every Restore while the backend is unreachable, with its reason", () => {
    state().titlesDeletedLoaded([gone("movie-603", "The Matrix")]);
    state().titleDeletedTick("movie-603", true);
    state().titlesMarkUnreachable(true);
    assert.ok(group(page()).includes("Restore. The admin backend cannot be reached."));
    assert.ok(group(page()).includes('aria-label="Restore. The admin backend cannot be reached."'));
  });
});
