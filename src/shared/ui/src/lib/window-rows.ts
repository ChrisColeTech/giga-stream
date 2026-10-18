import type { RowLayout, RowRange, RowSpec, ScrollAnchor, WindowSegment } from "./window-types";

/* The windowing maths (`docs/32` section 2; moved from the interface by `docs/41` section 4.1, one copy for both
   programs). Pure: no React, DOM or store. Fixed geometry makes every answer closed-form, so a row's place is known
   without mounting it. */

/** The columns and heights for a container whose content is `width` wide. The column rule is CSS
 *  `repeat(auto-fill, minmax(minColumn, 1fr))` with the spec's gap. */
export function rowLayout(width: number, spec: RowSpec): RowLayout {
  const inner = Math.max(0, width);
  const columns = spec.minColumn <= 0 ? 1 : Math.max(1, Math.floor((inner + spec.gap) / (spec.minColumn + spec.gap)));
  const columnWidth = (inner - (columns - 1) * spec.gap) / columns;
  const rowHeight = spec.fixedHeight ?? Math.ceil(columnWidth * spec.artAspect + spec.chrome);
  return { columns, rowHeight, pitch: rowHeight + spec.gap };
}

/** How many rows `count` items take. */
export function rowCount(count: number, columns: number): number {
  return Math.ceil(Math.max(0, count) / Math.max(1, columns));
}

/** The rows to mount: those the viewport touches, widened by `overscan` rows each side. `top` is the viewport's top
 *  edge measured from the first row's top (negative while the viewport is still above the rows). */
export function visibleRows(
  view: { readonly top: number; readonly height: number },
  layout: RowLayout,
  rows: number,
  overscan: number,
): RowRange {
  if (rows <= 0) return { first: 0, last: -1 };
  /* A non-finite offset (a failed measurement) reads as the top. */
  const edge = Number.isFinite(view.top) ? view.top : 0;
  /* Clamped before widening, so a viewport past the end (the list just got shorter, or a scroll offset carried over
     from a taller list) still shows the last rows. */
  const top = Math.min(rows - 1, Math.max(0, Math.floor(edge / layout.pitch)));
  const bottom = Math.min(rows - 1, Math.max(top, Math.floor((edge + Math.max(0, view.height) - 1) / layout.pitch)));
  return nonEmptyRange({ first: Math.max(0, top - overscan), last: Math.min(rows - 1, bottom + overscan) }, rows);
}

/** Never a blank viewport: a range that holds no row of a non-empty list is replaced by the nearest rows (the first
 *  ones when it lies above the list, the last ones when it lies past the end). A sound range is returned as it is. */
export function nonEmptyRange(range: RowRange, rows: number): RowRange {
  if (rows <= 0) return { first: 0, last: -1 };
  const span = Number.isFinite(range.last - range.first) ? Math.max(1, range.last - range.first + 1) : 1;
  if (range.last >= range.first && range.first >= 0 && range.last < rows) return range;
  if (range.first >= rows || (range.last >= range.first && range.last >= rows)) {
    const last = rows - 1;
    return { first: Math.max(0, last - span + 1), last };
  }
  return { first: 0, last: Math.min(rows - 1, span - 1) };
}

/** Whether a Library list starts again at its top. A view switch (Rows, Grid, List, any direction) is a new list and
 *  never inherits the old offset; so does a first page read, and a first mount. Returning to the Library tab changes
 *  neither the view nor the read, so the position is kept (`docs/32` revisit rule). */
export function resetsToTop(input: {
  readonly loading: boolean;
  readonly view: string;
  readonly previousView: string | null;
}): boolean {
  return input.loading || input.previousView !== input.view;
}

/** The blank heights and mounted rows, top to bottom. A row outside the range (the focused card's) is mounted too,
 *  with a gap on each side, so the total height is always `rows * pitch`. */
export function windowSegments(
  range: RowRange,
  pinnedRow: number | null,
  rows: number,
  layout: RowLayout,
): WindowSegment[] {
  const mounted: number[] = [];
  const pin = pinnedRow !== null && pinnedRow >= 0 && pinnedRow < rows ? pinnedRow : null;
  if (pin !== null && pin < range.first) mounted.push(pin);
  for (let row = range.first; row <= range.last; row += 1) mounted.push(row);
  if (pin !== null && pin > range.last) mounted.push(pin);
  const segments: WindowSegment[] = [];
  let next = 0;
  for (const index of mounted) {
    if (index > next) segments.push({ kind: "gap", height: (index - next) * layout.pitch });
    segments.push({ kind: "row", index });
    next = index + 1;
  }
  if (rows > next) segments.push({ kind: "gap", height: (rows - next) * layout.pitch });
  return segments;
}

/** The first visible item under `layout`, or null while the viewport is still above the rows (nothing to hold). */
export function anchorOf(top: number, layout: RowLayout): ScrollAnchor | null {
  if (top < 0) return null;
  const row = Math.floor(top / layout.pitch);
  return { index: row * layout.columns, fraction: (top - row * layout.pitch) / layout.pitch };
}

/** The scroll offset that puts the anchored item back where it was, once the rows are laid out as `layout`. */
export function scrollTopForAnchor(anchor: ScrollAnchor, layout: RowLayout, gridTop: number): number {
  const row = Math.floor(anchor.index / layout.columns);
  return Math.round(gridTop + (row + anchor.fraction) * layout.pitch);
}

/** The smallest scroll that brings an item's row fully into view: unchanged when it already is. */
export function scrollTopToReveal(
  index: number,
  layout: RowLayout,
  view: { readonly top: number; readonly height: number },
  gridTop: number,
): number {
  const rowTop = gridTop + Math.floor(index / layout.columns) * layout.pitch;
  if (rowTop < view.top) return rowTop;
  const rowBottom = rowTop + layout.rowHeight;
  return rowBottom > view.top + view.height ? Math.max(0, rowBottom - view.height) : view.top;
}

/** The item an arrow, Home or End key moves to, in a grid of `columns` (a list has one). Null: not a movement key, or
 *  an edge. */
export function gridStep(key: string, index: number, columns: number, count: number): number | null {
  if (index < 0 || index >= count) return null;
  const to =
    key === "ArrowLeft" ? index - 1
      : key === "ArrowRight" ? index + 1
        : key === "ArrowUp" ? index - columns
          : key === "ArrowDown" ? index + columns
            : key === "Home" ? 0
              : key === "End" ? count - 1
                : null;
  return to === null || to < 0 || to >= count || to === index ? null : to;
}
