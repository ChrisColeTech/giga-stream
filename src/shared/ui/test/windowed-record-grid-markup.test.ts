import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NO_SELECTION, selectAllMatching, tickRow, type ListSelection } from "../src/lib/list-selection";
import { listHeight } from "../src/lib/list-window";
import { HEADER_HEIGHT } from "../src/lib/window-constants";
import type { GridLayout } from "../src/lists/record-grid-layout";
import { RecordGrid } from "../src/lists/RecordGrid";
import { RecordGridRow } from "../src/lists/RecordGridRow";
import type { WindowedRecordGridProps } from "../src/lists/windowed-grid-types";
import { WindowedRecordGrid } from "../src/lists/WindowedRecordGrid";

interface Item { readonly id: string; readonly name: string; readonly disabled: boolean }
const NOTHING = (): void => undefined;
const LAYOUT: GridLayout = { tracks: ["minmax(9rem,1.4fr)", "6rem"], end: "14rem", minWidth: "40rem" };
const HEADINGS = [{ key: "name", label: "name", sortable: true }, { key: "state", label: "state" }];
const count = (html: string, needle: string): number => html.split(needle).length - 1;
const item = (index: number): Item => ({ id: `c${index}`, name: `Channel ${index}`, disabled: index % 7 === 0 });

function props(total: number, over: Partial<WindowedRecordGridProps<Item>> = {}): WindowedRecordGridProps<Item> {
  return {
    ariaLabel: "Channels", layout: LAYOUT, headings: HEADINGS, total, resetKey: "q=",
    rowAt: (index) => (index < total ? item(index) : undefined),
    idOf: (row) => row.id,
    selection: NO_SELECTION,
    renderRow: (row, _index, ticked) => createElement(RecordGridRow, {
      state: row.disabled ? "disabled" : "enabled", dimmed: row.disabled, ticked,
      tick: { label: `Select ${row.name}`, onToggle: NOTHING }, onOpen: NOTHING, end: "END",
      children: [createElement("span", { key: "n" }, row.name), createElement("span", { key: "s" }, "enabled")],
    }),
    ...over,
  };
}
const render = (p: WindowedRecordGridProps<Item>): string => renderToStaticMarkup(createElement(WindowedRecordGrid<Item>, p));
const gaps = (html: string): number[] =>
  [...html.matchAll(/<li aria-hidden="true" class="flex-none" style="height:(\d+)px"/g)].map((match) => Number(match[1]));
const mountedRows = (html: string): number => count(html, "data-index=");
const html5000 = (selection: ListSelection | undefined): string => render(props(5000, { selection }));

describe("at or under 100 rows it is the plain grid, exactly as today", () => {
  it("draws every row with no scroller of its own and no window attributes", () => {
    const html = render(props(100));
    assert.equal(count(html, "<li"), 100);
    assert.ok(!html.includes("overflow-auto") && !html.includes("sticky") && html.includes("overflow-x-auto"));
    assert.ok(!html.includes("data-index") && !html.includes("aria-rowcount") && !html.includes("data-primary"));
  });
  it("matches the plain RecordGrid's markup row for row", () => {
    const p = props(3, { sort: undefined });
    const plain = renderToStaticMarkup(createElement(RecordGrid, {
      ariaLabel: "Channels", layout: LAYOUT, headings: HEADINGS, ticks: true,
      children: [0, 1, 2].map((at) => createElement(Fragment, { key: at }, p.renderRow(item(at), at, false))),
    }));
    assert.equal(render(p), plain);
  });
  it("draws the skeleton for no rows, and a skeleton row for a row not loaded", () => {
    assert.equal(count(render(props(0)), "pointer-events-none grid h-9"), 6);
    const holes = render(props(5, { rowAt: (index) => (index === 2 ? undefined : item(index)) }));
    assert.equal(count(holes, "pointer-events-none grid h-9"), 1);
    assert.equal(count(holes, "Channel "), 4 * 2);
  });
});

describe("above 100 rows it is windowed", () => {
  const total = 5000;
  const html = render(props(total));
  it("owns one scroller for both axes, as tall as the room it has, with the header sticky in it", () => {
    assert.ok(html.includes(`class="overflow-auto" style="height:${listHeight(total, 0)}px"`));
    assert.ok(html.includes("sticky top-0 z-10") && html.includes("min-width:40rem"));
    assert.ok(html.indexOf("sticky top-0") < html.indexOf("<ul"));
  });
  it("mounts only the rows of the first viewport and stands the rest in as a spacer of their height", () => {
    const visible = Math.floor((listHeight(total, 0) - HEADER_HEIGHT - 1) / 36) + 1;
    assert.equal(mountedRows(html), visible + 2);
    assert.deepEqual(gaps(html), [(total - visible - 2) * 36]);
    assert.ok(!html.includes('data-index="4999"'));
  });
  it("mounts the same number of rows for 101, 5,000 and 27,000", () => {
    const counts = [101, 5000, 27000].map((rows) => mountedRows(render(props(rows))));
    assert.equal(new Set(counts).size, 1, String(counts));
  });
  it("carries aria-rowcount on the list and aria-rowindex and data-primary on each mounted row", () => {
    assert.ok(html.includes(`aria-rowcount="${total}"`));
    assert.ok(html.includes('data-index="0" aria-rowindex="1"') && html.includes('data-index="3" aria-rowindex="4"'));
    assert.equal(count(html, "data-primary"), mountedRows(html));
  });
  it("draws a skeleton row in place of a row whose page is not loaded", () => {
    const partial = render(props(total, { rowAt: (index) => (index < 4 ? item(index) : undefined) }));
    assert.equal(mountedRows(partial), 4);
    assert.ok(count(partial, "pointer-events-none grid h-9") > 0);
    const [gap] = gaps(partial);
    const skeletons = count(partial, "pointer-events-none grid h-9");
    assert.equal(((gap ?? 0) / 36) + skeletons + 4, total);
  });
  it("keeps the state word, the dimmed row and the tick column as the plain grid draws them", () => {
    assert.ok(html.includes('data-st="disabled"') && html.includes(" opacity-45"));
    assert.ok(html.includes('aria-label="Select Channel 1"'));
  });
});

describe("ticks by id", () => {
  it("draws a row ticked when its id is selected, wherever it was ticked", () => {
    let selection: ListSelection = tickRow(NO_SELECTION, "c2", true);
    selection = tickRow(selection, "c3001", true);
    const html = render(props(5000, { selection }));
    assert.equal(count(html, "data-ticked"), 1);
    assert.ok(html.includes('data-index="2" aria-rowindex="3" data-st="enabled" data-ticked=""'));
  });
  it("draws every mounted row ticked under all-matching, but the excepted", () => {
    const selection = tickRow(selectAllMatching("q="), "c1", false);
    const html = render(props(5000, { selection }));
    assert.equal(count(html, "data-ticked"), mountedRows(html) - 1);
  });
  it("has no tick column without a selection", () => {
    assert.ok(html5000(undefined).includes("grid-template-columns:minmax(9rem,1.4fr) 6rem 14rem"));
    assert.ok(html5000(NO_SELECTION).includes("grid-template-columns:1.25rem minmax(9rem,1.4fr) 6rem 14rem"));
  });
});

describe("sortable headings", () => {
  it("are buttons with aria-sort and an arrow on the sorted column", () => {
    const asc = render(props(5000, { sort: { state: { key: "name", dir: "asc" }, onSort: NOTHING } }));
    assert.ok(asc.includes('aria-sort="ascending"') && asc.includes("lucide-arrow-up"));
    const other = render(props(5000, { sort: { state: { key: "year", dir: "desc" }, onSort: NOTHING } }));
    assert.ok(other.includes('aria-sort="none"') && !other.includes("lucide-arrow"));
    assert.equal(count(asc, "aria-sort"), 1, "only the sortable column is a button");
  });
  it("are plain cells without a sort", () => {
    assert.ok(!render(props(5000)).includes("aria-sort"));
  });
});
