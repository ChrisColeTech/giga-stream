/** The fixed geometry of one windowed view (`docs/32` section 2.1, moved here by `docs/41` section 4.1). Every number is a
 *  CSS pixel and matches the class the view's rows are drawn with, so the maths and the render cannot disagree. */
export interface RowSpec {
  /** Padding left and right of the rows; the layout width is the container's width minus both. */
  readonly padX: number;
  /** Padding above the first row. There is none below: the last row's own gap is the bottom space. */
  readonly padTop: number;
  /** The gap between columns and between rows. */
  readonly gap: number;
  /** The narrowest a column may be (CSS `auto-fill, minmax(min, 1fr)`); 0 means one column. */
  readonly minColumn: number;
  /** Art height over column width (a 2:3 poster is 1.5). */
  readonly artAspect: number;
  /** Height drawn under the art: title line, verb row and the gaps between them. */
  readonly chrome: number;
  /** A row of constant height (the list); the art and chrome are then ignored. */
  readonly fixedHeight?: number;
}

/** The columns and heights the container's width yields. */
export interface RowLayout {
  readonly columns: number;
  readonly rowHeight: number;
  /** A row and the gap after it: the distance between two row tops. */
  readonly pitch: number;
}

/** An inclusive range of row indices; `last < first` means no rows. */
export interface RowRange {
  readonly first: number;
  readonly last: number;
}

/** What the window draws, top to bottom: blank height standing for unmounted rows, and mounted rows. */
export type WindowSegment =
  | { readonly kind: "gap"; readonly height: number }
  | { readonly kind: "row"; readonly index: number };

/** The first visible item, so a re-flow can keep it first: the item index of its row's start, and how far into the
 *  row the viewport already is (0 to 1). */
export interface ScrollAnchor {
  readonly index: number;
  readonly fraction: number;
}
