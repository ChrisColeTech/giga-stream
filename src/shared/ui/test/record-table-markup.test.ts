import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createColumnHelper } from "@tanstack/react-table";
import { columnTemplate, fitColumns, recordFeatures } from "../src/lib/record-columns";
import { RecordTable } from "../src/lists/RecordTable";
import type { RecordRowView, RecordTableProps } from "../src/lists/record-table-types";
import { SelectAllScope } from "../src/lists/SelectAllScope";

interface Row { readonly id: number; readonly name: string; readonly size: number; readonly state: string }

const column = createColumnHelper<typeof recordFeatures, Row>();
const COLUMNS = column.columns([
  column.accessor((row) => row.name, {
    id: "name", header: "name", size: 160, sortFn: "alphanumeric", meta: { kind: "name", grow: 1.4, priority: 0 },
    cell: (info) => info.getValue(),
  }),
  column.accessor((row) => row.size, {
    id: "size", header: "size", size: 64, sortFn: "basic", meta: { kind: "number", priority: 2 },
    cell: (info) => String(info.getValue()),
  }),
  column.accessor((row) => row.state, {
    id: "kind", header: "kind", size: 80, enableSorting: false, meta: { kind: "text", priority: 1 },
    cell: (info) => info.getValue(),
  }),
  column.accessor((row) => row.state, {
    id: "state", header: "state", size: 80, enableSorting: false, meta: { kind: "state", priority: 0 },
    cell: (info) => info.getValue(),
  }),
]);

const NOTHING = (): void => undefined;
const ROWS: Row[] = [
  { id: 1, name: "Fixture News", size: 12, state: "live" },
  { id: 2, name: "Old Movies", size: 3, state: "disabled" },
];
const view = (row: Row): RecordRowView => ({
  state: row.state,
  dimmed: row.state === "disabled",
  ticked: row.id === 1,
  tick: { label: `Select ${row.name}`, onToggle: NOTHING },
  onOpen: NOTHING,
  end: createElement("button", { type: "button" }, "Delete"),
});

const table = (extra: Partial<RecordTableProps<Row>> = {}): string =>
  renderToStaticMarkup(
    createElement(RecordTable<Row>, { ariaLabel: "Things", columns: COLUMNS, rows: ROWS, idOf: (row) => String(row.id), rowView: view, ...extra }),
  );
const count = (html: string, needle: string): number => html.split(needle).length - 1;

test("the header has one cell per visible column, and the rows one cell each, in the same order", () => {
  const html = table();
  for (const heading of [">name<", ">size<", ">kind<", ">state<"]) assert.ok(html.includes(heading), heading);
  assert.equal(count(html, "data-col="), ROWS.length * COLUMNS.length);
  assert.ok(html.indexOf('data-col="name"') < html.indexOf('data-col="size"'));
});

test("the root holds ONE --cols; the header and every row use it (and so does a skeleton row)", () => {
  const template = columnTemplate(COLUMNS, fitColumns(COLUMNS, 0));
  const html = table();
  assert.equal(count(html, `--cols:${template}`), 1);
  assert.equal(count(html, "grid-template-columns:var(--cols)"), 1 + ROWS.length);
  const waiting = table({ waiting: true });
  assert.equal(count(waiting, "grid-template-columns:var(--cols)"), 1 + 6);
  assert.ok(waiting.includes("animate-skel-shimmer") && !waiting.includes("Fixture News") && waiting.includes('aria-busy="true"'));
});

test("an empty list is skeleton rows too, never a sentence", () => {
  const html = table({ rows: [] });
  assert.equal(count(html, "aria-hidden=\"true\" class=\"pointer-events-none"), 6);
  assert.ok(!html.includes("<li data-st"));
});

test("a sortable heading is a button with aria-sort; a column that cannot sort is plain text", () => {
  const html = table();
  assert.match(html, /<button[^>]*aria-sort="none"[^>]*title="Sort by name"/);
  assert.match(html, /<button[^>]*aria-sort="none"[^>]*title="Sort by size"/);
  assert.ok(!html.includes('title="Sort by kind"') && !html.includes('title="Sort by state"'));
  assert.equal(count(html, "aria-sort="), 2);
});

test("a server sort puts its direction on its column's heading and does not reorder the rows here", () => {
  const html = table({ sort: { state: { key: "name", dir: "desc" }, onSort: NOTHING } });
  assert.match(html, /<button[^>]*aria-sort="descending"[^>]*title="Sort by name"/);
  assert.ok(html.indexOf("Fixture News") < html.indexOf("Old Movies"));
});

test("the header's tick cell holds the three-state All of the scope, above the row ticks", () => {
  const all = { label: "Select all things", checked: "mixed" as const, onToggle: NOTHING };
  const html = renderToStaticMarkup(createElement(SelectAllScope, { all, children: createElement(RecordTable<Row>, {
    ariaLabel: "Things", columns: COLUMNS, rows: ROWS, idOf: (row) => String(row.id), rowView: view }) }));
  assert.ok(html.includes('aria-label="Select all things"'));
  assert.ok(html.indexOf("Select all things") < html.indexOf('aria-label="Select Fixture News"'));
  assert.ok(!table().includes("Select all"));
});

test("a row draws its state, its tick fill, a dimmed disabled row, and the end cell outside the open button", () => {
  const html = table();
  assert.ok(html.includes('data-st="live"') && html.includes('data-st="disabled"'));
  assert.match(html, /<li data-st="disabled"[^>]*hover:bg-hov opacity-45/);
  assert.doesNotMatch(html, /<li data-st="live"[^>]*opacity-45/);
  assert.equal(count(html, "data-ticked"), 1);
  assert.equal(count(html, "data-primary"), ROWS.length);
  const row = html.slice(html.indexOf("<li "), html.indexOf("</li>"));
  assert.ok(row.indexOf("</button>") < row.indexOf(">Delete<"), "the end sits after the open button");
  assert.ok(row.includes("z-10") && row.includes("justify-end"));
});

test("a row with no record to open draws no spanning button; its cells sit directly on the --cols tracks", () => {
  const noOpen = (row: Row): RecordRowView => ({ state: row.state, end: null });
  const html = table({ rowView: noOpen });
  assert.equal(count(html, "data-primary"), 0);
  assert.equal(count(html, "data-col="), ROWS.length * COLUMNS.length);
  const row = html.slice(html.indexOf("<li "), html.indexOf("</li>"));
  assert.ok(!row.includes("<button"), "no open button in the row (the header's sort buttons are not the row's)");
  assert.ok(row.indexOf('data-col="name"') < row.indexOf('data-col="size"'));
  assert.ok(row.includes("z-10") && row.includes("justify-end"), "the end cell keeps its place");
});

test("a list with no tick column draws no tick and no header tick cell", () => {
  const html = table({ ticks: false });
  assert.ok(!html.includes('type="checkbox"') && !html.includes('role="checkbox"'));
  assert.ok(html.includes("grid-column:1 / span 4") && !html.includes("grid-column:2 / span 4"));
});

test("fill takes the group's height from a 317px floor; bounded is as tall as its rows up to 10, then scrolls", () => {
  const fill = table();
  assert.ok(fill.includes("min-height:317px") && fill.includes("absolute inset-0"));
  const bounded = table({ size: "bounded" });
  assert.ok(bounded.includes("max-height:389px") && !bounded.includes("absolute inset-0") && !bounded.includes("min-height"));
});

test("the scroller keeps its scrollbar gutter and scrolls sideways only as a last resort", () => {
  const html = table();
  assert.ok(html.includes("[scrollbar-gutter:stable]") && html.includes("overflow-x-auto"));
  assert.ok(html.includes("sticky top-0") && html.includes("height:29px"));
});
