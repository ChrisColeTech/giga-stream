import {
  columnSizingFeature,
  columnVisibilityFeature,
  createSortedRowModel,
  metaHelper,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
  type ColumnDef,
  type ColumnVisibilityState,
} from "@tanstack/react-table";
import { END_COLUMN_PX, ROW_GAP, ROW_PADDING_PX, TICK_COLUMN_PX } from "./window-constants";

/* THE ONE COLUMN-DEFINITION API of the admin's index lists (`docs/45` sections 2.2 and 2.3): the table features (the only
 * TanStack surface the lists use), the typed column meta, and two pure functions: which columns fit a width, and the one
 * grid template the header and every row share. No React here. */

/** What a column's cell is, which picks its text style (`record-grid-classes`). */
export type RecordColumnKind = "name" | "text" | "mono" | "number" | "state" | "custom";

export interface RecordColumnMeta {
  readonly kind: RecordColumnKind;
  /** The column takes the room left over, in this many shares (`fr`); absent, it is exactly `size` wide. */
  readonly grow?: number;
  /** 0 is never hidden; a higher number is hidden sooner when the pane is too narrow. */
  readonly priority: number;
}

export const recordFeatures = tableFeatures({
  rowSortingFeature,
  columnVisibilityFeature,
  columnSizingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic, text: sortFn_text },
  columnMeta: metaHelper<RecordColumnMeta>(),
});

export type RecordFeatures = typeof recordFeatures;

/** One list's columns: `column.columns([...])` of `createColumnHelper<RecordFeatures, RowView>()`. A column's `size` is its
 *  minimum width in px (converted to rem, so the 12px header and the 14px rows align) and its `meta` is required. */
export type RecordColumns<TData extends object> = Array<ColumnDef<RecordFeatures, TData>>;

/** The room a row spends outside its data columns. */
export interface FitOptions {
  /** The list has a tick column. */
  readonly tick: boolean;
  /** The end column's width in px. */
  readonly endPx: number;
}

export const DEFAULT_FIT: FitOptions = { tick: true, endPx: END_COLUMN_PX };

const DEFAULT_SIZE = 96;
const REM = 16;

interface ColumnSpec {
  readonly id: string;
  readonly size: number;
  readonly meta: RecordColumnMeta;
}

function specOf<TData extends object>(def: ColumnDef<RecordFeatures, TData>): ColumnSpec {
  return { id: def.id ?? "", size: def.size ?? DEFAULT_SIZE, meta: def.meta ?? { kind: "text", priority: 1 } };
}

/** The width the row needs at its narrowest with these data columns. */
function neededPx(specs: readonly ColumnSpec[], options: FitOptions): number {
  const tracks = specs.length + (options.tick ? 1 : 0) + 1;
  const fixed = ROW_PADDING_PX + (options.tick ? TICK_COLUMN_PX : 0) + options.endPx + ROW_GAP * (tracks - 1);
  return fixed + specs.reduce((sum, spec) => sum + spec.size, 0);
}

/** Which columns show in a scroller `width` px wide: while the minimums exceed it, the column of highest `priority` goes
 *  (the later one on a tie); priority 0 never goes. A width of 0 (not measured, or a hidden surface) hides nothing. */
export function fitColumns<TData extends object>(
  columns: RecordColumns<TData>,
  width: number,
  options: FitOptions = DEFAULT_FIT,
): ColumnVisibilityState {
  const shown = columns.map(specOf);
  while (width > 0 && neededPx(shown, options) > width) {
    let drop = -1;
    shown.forEach((spec, index) => {
      if (spec.meta.priority > 0 && (drop < 0 || spec.meta.priority >= (shown[drop]?.meta.priority ?? 0))) drop = index;
    });
    if (drop < 0) break;
    shown.splice(drop, 1);
  }
  const ids = new Set(shown.map((spec) => spec.id));
  return Object.fromEntries(columns.map((def) => [specOf(def).id, ids.has(specOf(def).id)]));
}

const remOf = (px: number): string => `${px / REM}rem`;

/** The `grid-template-columns` of the header, every row and every skeleton row: the tick, the visible data columns in
 *  order (`{size}rem`, or `minmax({size}rem,{grow}fr)` for a growing one) and the end. One string, set once as `--cols`. */
export function columnTemplate<TData extends object>(
  columns: RecordColumns<TData>,
  visibility: ColumnVisibilityState,
  options: FitOptions = DEFAULT_FIT,
): string {
  const data = columns.map(specOf).filter((spec) => visibility[spec.id] !== false).map((spec) =>
    spec.meta.grow === undefined ? remOf(spec.size) : `minmax(${remOf(spec.size)},${spec.meta.grow}fr)`,
  );
  return [...(options.tick ? [remOf(TICK_COLUMN_PX)] : []), ...data, remOf(options.endPx)].join(" ");
}
