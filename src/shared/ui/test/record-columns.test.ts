import assert from "node:assert/strict";
import test from "node:test";
import { createColumnHelper } from "@tanstack/react-table";
import {
  columnTemplate, fitColumns, recordFeatures, type FitOptions, type RecordColumnMeta,
} from "../src/lib/record-columns";
import { END_COLUMN_PX, ROW_GAP, ROW_PADDING_PX, TABLE_MIN_HEIGHT, TICK_COLUMN_PX } from "../src/lib/window-constants";

interface Row { readonly name: string }

const column = createColumnHelper<typeof recordFeatures, Row>();
const col = (id: string, size: number, meta: RecordColumnMeta) =>
  column.accessor((row) => row.name, { id, header: id, size, meta, cell: (info) => info.getValue() });

/* name (grow, never hidden), state (never hidden), then c, b, a: a hides first, then b, then c. */
const COLUMNS = column.columns([
  col("name", 160, { kind: "name", grow: 1.4, priority: 0 }),
  col("c", 100, { kind: "text", priority: 1 }),
  col("b", 100, { kind: "mono", grow: 1, priority: 2 }),
  col("a", 100, { kind: "number", priority: 3 }),
  col("state", 96, { kind: "state", priority: 0 }),
]);

const FIT: FitOptions = { tick: true, endPx: END_COLUMN_PX };
const shown = (width: number, options: FitOptions = FIT): string[] =>
  Object.entries(fitColumns(COLUMNS, width, options)).filter(([, on]) => on).map(([id]) => id);

/* The room a row needs: padding, tick, end, the gaps between its tracks and the columns' minimums. */
const needed = (ids: number[]): number =>
  ROW_PADDING_PX + TICK_COLUMN_PX + END_COLUMN_PX + ROW_GAP * (ids.length + 1) + ids.reduce((sum, size) => sum + size, 0);

test("the table's minimum height is the header and eight rows", () => {
  assert.equal(TABLE_MIN_HEIGHT, 29 + 8 * 36);
});

test("a width that suffices hides nothing, and a width of 0 (not measured, hidden) hides nothing", () => {
  assert.deepEqual(shown(needed([160, 100, 100, 100, 96])), ["name", "c", "b", "a", "state"]);
  assert.deepEqual(shown(5000), ["name", "c", "b", "a", "state"]);
  assert.deepEqual(shown(0), ["name", "c", "b", "a", "state"]);
});

test("a narrower pane hides the columns in priority order, the highest number first", () => {
  const all = needed([160, 100, 100, 100, 96]);
  assert.deepEqual(shown(all - 1), ["name", "c", "b", "state"]);
  assert.deepEqual(shown(needed([160, 100, 100, 96]) - 1), ["name", "c", "state"]);
  assert.deepEqual(shown(needed([160, 100, 96]) - 1), ["name", "state"]);
});

test("a priority 0 column is never hidden, however narrow the pane", () => {
  assert.deepEqual(shown(1), ["name", "state"]);
  assert.deepEqual(shown(100, { tick: false, endPx: 0 }), ["name", "state"]);
});

test("fitting is monotonic: a wider pane never shows fewer columns", () => {
  let previous = 0;
  for (let width = 0; width <= 900; width += 7) {
    const count = shown(width).length;
    if (width >= 300) assert.ok(count >= previous, `${width}: ${count} < ${previous}`);
    if (width >= 300) previous = count;
  }
});

test("a list with no tick column needs 32px less (the tick and its gap)", () => {  const withTick = needed([160, 100, 100, 100, 96]);
  assert.equal(shown(withTick - 1, { tick: false, endPx: END_COLUMN_PX }).length, 5);
  assert.equal(shown(withTick - 32, { tick: false, endPx: END_COLUMN_PX }).length, 5);
  assert.equal(shown(withTick - 33, { tick: false, endPx: END_COLUMN_PX }).length, 4);
});

test("columnTemplate is one string: the tick, each visible column in order (fixed rem or minmax with fr), then the end", () => {
  const full = columnTemplate(COLUMNS, fitColumns(COLUMNS, 0));
  assert.equal(full, "1.25rem minmax(10rem,1.4fr) 6.25rem minmax(6.25rem,1fr) 6.25rem 6rem 5.5rem");
  const narrow = columnTemplate(COLUMNS, fitColumns(COLUMNS, 1));
  assert.equal(narrow, "1.25rem minmax(10rem,1.4fr) 6rem 5.5rem");
  assert.equal(columnTemplate(COLUMNS, fitColumns(COLUMNS, 1, { tick: false, endPx: END_COLUMN_PX }), { tick: false, endPx: END_COLUMN_PX }),
    "minmax(10rem,1.4fr) 6rem 5.5rem");
});
