import assert from "node:assert/strict";
import test from "node:test";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CELL_NAME, CELL_NUMBER } from "../src/lists/record-grid-classes";
import { gridColumns, TICK_TRACK, type GridLayout } from "../src/lists/record-grid-layout";
import { RecordGrid } from "../src/lists/RecordGrid";
import { RecordGridRow } from "../src/lists/RecordGridRow";
import { SkeletonGrid } from "../src/lists/SkeletonGrid";

const NOTHING = (): void => undefined;
const LAYOUT: GridLayout = { tracks: ["3.5rem", "minmax(9rem,1.4fr)", "6rem"], end: "14rem", minWidth: "40rem" };
const HEADINGS = [
  { key: "number", label: "number", align: "right" as const },
  { key: "name", label: "name" },
  { key: "state", label: "state" },
];
const count = (html: string, needle: string) => html.split(needle).length - 1;

const cells = [
  createElement("span", { key: "n", className: CELL_NUMBER }, "101"),
  createElement("span", { key: "m", className: CELL_NAME }, "Fixture News"),
  createElement("span", { key: "s" }, "live"),
];

function grid(rows: ReactNode, ticks = true): string {
  return renderToStaticMarkup(
    createElement(RecordGrid, { ariaLabel: "Channels", layout: LAYOUT, headings: HEADINGS, ticks, children: rows }),
  );
}

const row = (extra: Record<string, unknown> = {}) =>
  createElement(RecordGridRow, {
    state: "live",
    onOpen: NOTHING,
    end: "END",
    tick: { label: "Select Fixture News", onToggle: NOTHING },
    children: cells,
    ...extra,
  });

test("the header is the template's: sans 12px semibold faint on the panel over a hairline, one cell per heading", () => {
  const html = grid(row());
  assert.ok(html.includes("border-b border-hair bg-panel") && html.includes("font-sans text-xs font-semibold text-faint"));
  for (const heading of HEADINGS) assert.ok(html.includes(`>${heading.label}</span>`), heading.label);
  assert.ok(html.includes("text-right"), "a number column is right-aligned");
});

test("one column template serves the header and the row: tick, the data tracks, then the end", () => {
  const template = gridColumns(LAYOUT, true);
  assert.equal(template, `${TICK_TRACK} 3.5rem minmax(9rem,1.4fr) 6rem 14rem`);
  assert.equal(count(grid(row()), `grid-template-columns:${template}`), 2);
  assert.equal(gridColumns(LAYOUT, false), "3.5rem minmax(9rem,1.4fr) 6rem 14rem");
});

test("the list scrolls itself sideways inside its group, at its minimum width", () => {
  const html = grid(row());
  assert.ok(html.includes("overflow-x-auto") && html.includes("min-width:40rem"));
});

test("a row is a 36px list item with a hover fill and a spanning button over the data cells", () => {
  const html = grid(row());
  assert.ok(html.includes("<ul") && html.includes('aria-label="Channels"') && html.includes("<li"));
  assert.ok(html.includes("h-9") && html.includes("rounded-ctl") && html.includes("hover:bg-hov"));
  assert.ok(html.includes("grid-cols-subgrid") && html.includes("grid-column:2 / span 3"));
  const start = html.indexOf("grid-cols-subgrid");
  const button = html.slice(start, html.indexOf("</button>", start));
  assert.ok(button.includes("Fixture News") && button.includes("101") && !button.includes("END"));
});

test("the tick and the end action sit outside the spanning button", () => {
  const html = grid(row());
  const open = html.indexOf("grid-cols-subgrid");
  const close = html.indexOf("</button>", open);
  assert.ok(html.indexOf('aria-label="Select Fixture News"') < open);
  assert.ok(html.indexOf("END") > close);
});

test("the header's tick cell is empty: select-all is the selection toolbar's All, never a header tick", () => {
  const html = grid(row());
  const header = html.slice(0, html.indexOf("<ul"));
  assert.ok(!header.includes('role="checkbox"') && !header.includes("Select all"));
  assert.ok(header.includes("<span aria-hidden=\"true\"></span><span class=\"truncate text-right\">number</span>"));
});

test("with no selection there is no tick column and the cells start at line 1", () => {
  const html = grid(row({ tick: undefined }), false);
  assert.ok(!html.includes('role="checkbox"') && html.includes("grid-column:1 / span 3"));
});

test("a ticked row wears the selected fill and a tick that is on", () => {
  const html = grid(row({ ticked: true }));
  assert.ok(html.includes('data-ticked=""') && html.includes("bg-ctl") && html.includes('aria-checked="true"'));
  assert.ok(!grid(row()).includes("data-ticked"));
});

test("the state is the row's data-st; a disabled record is dimmed to 45%", () => {
  assert.ok(grid(row({ state: "preparing" })).includes('data-st="preparing"'));
  assert.ok(grid(row({ state: "disabled", dimmed: true })).includes(' opacity-45"'));
  assert.ok(!grid(row()).includes(' opacity-45"'));
});

test("the skeleton wears the header's column set: a tick tile and one shimmer per data track", () => {
  const html = grid(createElement(SkeletonGrid, { rows: 4 }));
  assert.equal(count(html, "pointer-events-none grid h-9"), 4);
  assert.equal(count(html, "animate-skel-shimmer"), 4 * (1 + 3));
  assert.equal(count(html, `grid-template-columns:${gridColumns(LAYOUT, true)}`), 5);
  assert.ok(!html.includes("<button") || !html.slice(html.indexOf("<ul")).includes("<button"));
});

test("a row outside a grid is a mistake, not a silent misalignment", () => {
  assert.throws(() => renderToStaticMarkup(row()), /RecordGrid/);
  assert.throws(() => renderToStaticMarkup(createElement(SkeletonGrid)), /RecordGrid/);
});
