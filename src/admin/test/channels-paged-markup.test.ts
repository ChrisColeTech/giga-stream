import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createElement } from "react";
import { ChannelQueryRow } from "@/components/channels/ChannelQueryRow";
import { ChannelRows } from "@/components/channels/ChannelRows";
import { ChannelsIndex } from "@/components/channels/ChannelsIndex";
import { DEFAULT_CHANNEL_QUERY, queryKey } from "@/lib/channel-query";
import { useAppStore } from "@/store/app-store";
import type { AdminChannel } from "@/types/admin-channel";
import { stream } from "./support/channels-kit";
import { renderLive, resetStore, signInForTest } from "./support/store";

const state = () => useAppStore.getState();
const count = (html: string, needle: string): number => html.split(needle).length - 1;
const page = (from: number, size: number): AdminChannel[] =>
  Array.from({ length: size }, (_, i) => stream(`c${String(from + i).padStart(5, "0")}`, { name: `Stream ${from + i}` }));
const read = (index: number, total: number): void =>
  state().channelsPageLoaded(queryKey(DEFAULT_CHANNEL_QUERY), index, page(index * 100, Math.min(100, total - index * 100)), total, 1);
const firstRow = (): string => {
  const html = renderLive(createElement(ChannelsIndex));
  const from = html.indexOf('role="search"');
  return html.slice(from, html.indexOf("</div>", html.indexOf('aria-label="Channels table"')));
};

beforeEach(() => {
  resetStore();
  signInForTest();
});

describe("the list's first row (LoRA Studio's LibraryToolbar)", () => {
  it("opens with the search field, the Sort select, then a select for each filter, a row of its own above the toolbar with Refresh", () => {
    const html = firstRow();
    const at = (needle: string): number => html.indexOf(needle);
    assert.ok(html.startsWith('role="search"') && at('role="search"') < at('aria-label="Channels table"'));
    const order = ['aria-label="Search channels"', 'aria-label="Sort by"', 'aria-label="Kind"', 'aria-label="State"', 'aria-label="Origin"', 'aria-label="Enabled"', 'title="Refresh channels"'];
    assert.ok(order.every((needle, i) => at(needle) > (i === 0 ? -1 : at(order[i - 1] ?? ""))), order.map(at).join());
    assert.equal(count(html, "<select"), 5);
  });

  it("is a search with a leading icon that runs on Enter, and a sort SELECT (Name, Category, Kind, Source) with a direction", () => {
    const html = firstRow();
    assert.ok(/<input[^>]*type="search"[^>]*data-search=""/.test(html) && html.includes("lucide-search"));
    const sort = html.slice(html.indexOf('aria-label="Sort by"'), html.indexOf("</select>", html.indexOf('aria-label="Sort by"')));
    assert.deepEqual([...sort.matchAll(/>([A-Za-z]+)<\/option>/g)].map((m) => m[1]), ["Name", "Category", "Kind", "Source"]);
    assert.ok(html.includes('aria-label="Ascending. Sort direction"'));
  });

  it("offers each filter as a select whose first option lets everything through", () => {
    const html = firstRow();
    for (const [label, all] of [["Kind", "All kinds"], ["State", "All states"], ["Origin", "All origins"], ["Enabled", "Enabled or not"]]) {
      const from = html.indexOf(`aria-label="${label}"`);
      assert.ok(html.slice(from, html.indexOf("</select>", from)).includes(`<option value="all" selected="">${all}</option>`), label);
    }
  });

  it("has no chip rows, no labelled form rows, no placeholder text and no text under the controls", () => {
    const html = firstRow();
    for (const needle of ["aria-pressed", 'role="radiogroup"', "<label", "Segmented"]) assert.ok(!html.includes(needle), needle);
    assert.ok(!html.includes("placeholder=") && !html.includes("selected</"));
  });

  it("waits while a bulk run is going: every control is disabled, the reason its tooltip", () => {
    const row = (reason?: string) =>
      renderLive(createElement(ChannelQueryRow, { query: DEFAULT_CHANNEL_QUERY, onQuery: () => undefined, reason }));
    const waiting = row("Working.");
    assert.equal(count(waiting, 'disabled=""'), 7, "search, sort, four filters and the direction are natively disabled");
    assert.equal(count(waiting, 'title="Working."'), 11, "the search, and each select and the span a disabled select hovers through");
    assert.ok(!row().includes('disabled=""'));
  });
});

describe("Select all M matching", () => {
  it("appears only once every loaded row is ticked and the query holds more, and goes once they are all ticked", () => {
    read(0, 150);
    assert.ok(!firstRow().includes("matching"));
    state().channelsTickAll(true);
    assert.ok(firstRow().includes(">Select all 150 matching</button>"));
    state().channelsTickRows(page(100, 50));
    assert.ok(!firstRow().includes("matching"));
  });

  it("is not offered for a list that is all loaded", () => {
    read(0, 40);
    state().channelsTickAll(true);
    assert.ok(!firstRow().includes("matching"));
  });
});

describe("the channels grid over the paged list", () => {
  it("at or under 100 rows is the plain grid: every row, no scroller of its own, no sortable header", () => {
    read(0, 100);
    const html = renderLive(createElement(ChannelRows));
    assert.equal(count(html, "<li"), 100);
    assert.ok(!html.includes("data-index") && !html.includes("aria-rowcount") && !html.includes("aria-sort"));
  });

  it("above 100 rows is windowed: the total's height, a flat count of mounted rows, sortable headings", () => {
    read(0, 5000);
    const html = renderLive(createElement(ChannelRows));
    assert.ok(html.includes('aria-rowcount="5000"') && html.includes("sticky"));
    const mounted = count(html, "data-index=");
    assert.ok(mounted > 0 && mounted <= 30, String(mounted));
    assert.ok(html.includes('aria-sort="ascending"') && count(html, "aria-sort=") === 3);
    assert.ok(html.includes("Select Stream 0"));
  });

  it("draws a shimmer row for each mounted row whose page is not loaded, in place", () => {
    read(1, 5000);
    const html = renderLive(createElement(ChannelRows));
    assert.ok(!html.includes("Select Stream 0") && count(html, "pointer-events-none grid h-9") > 0);
    assert.ok(count(html, "aria-hidden") > 0 && !html.includes("Stream 100<"));
  });

  it("draws the shimmer grid, never a sentence, before the first page", () => {
    const html = renderLive(createElement(ChannelRows));
    assert.ok(count(html, "pointer-events-none grid h-9") > 0 && !html.includes("data-index"));
  });
});
