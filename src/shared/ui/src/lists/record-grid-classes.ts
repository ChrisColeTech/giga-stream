/* The cell vocabulary of a record list, from `CollectionRows`: a name is 14px medium on the row's 36px line, other text is
 * muted, a number is mono 12px and right-aligned so the figures compare down the column. A cell names its own text style,
 * so no two colour utilities share an element. */
export const CELL_NAME = "h-9 truncate leading-9 font-medium text-text";
export const CELL_TEXT = "truncate text-muted";
export const CELL_MONO = "truncate font-mono text-xs text-muted";
export const CELL_NUMBER = "truncate text-right font-mono text-xs tabular-nums text-muted";
