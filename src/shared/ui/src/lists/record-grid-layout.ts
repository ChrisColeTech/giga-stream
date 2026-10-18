import { createContext } from "react";

/** One index list's column set. The tracks are rem, never ch or px: a ch track is measured in its own element's font, so
 *  the 12px header and the 14px rows would get different widths and the columns would not line up (`CollectionRows`). */
export interface GridLayout {
  /** The data columns' tracks, in order (`3.5rem`, `minmax(9rem,1.4fr)`; no spaces inside a track). */
  readonly tracks: readonly string[];
  /** The last column's track: wide enough for the armed question (`Delete Playlist Entertainment?`). */
  readonly end: string;
  /** The list's own minimum width; below it the list scrolls sideways inside its group, never the page. */
  readonly minWidth: string;
}

/** The selection column: a 20px tick. */
export const TICK_TRACK = "1.25rem";

/** The grid-template-columns of the header, every row and every skeleton row: one string, so they line up. */
export function gridColumns(layout: GridLayout, selectable: boolean): string {
  return [...(selectable ? [TICK_TRACK] : []), ...layout.tracks, layout.end].join(" ");
}

/** What a row reads from its grid: the shared template and where its data cells start and how many there are. */
export interface GridShape {
  readonly columns: string;
  readonly selectable: boolean;
  /** The 1-based grid line the data cells start at (after the tick). */
  readonly first: number;
  readonly span: number;
}

export function gridShape(layout: GridLayout, selectable: boolean): GridShape {
  return {
    columns: gridColumns(layout, selectable),
    selectable,
    first: selectable ? 2 : 1,
    span: layout.tracks.length,
  };
}

export const GridShapeContext = createContext<GridShape | null>(null);

/** A windowed grid's row position (0-based), set around each mounted row: the row then carries `data-index`,
 *  `aria-rowindex` and a `data-primary` open button, which keyboard movement by index finds. Null in a plain grid. */
export const GridRowIndexContext = createContext<number | null>(null);
