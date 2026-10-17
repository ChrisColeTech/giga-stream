import { ROW_EPSILON } from "@/lib/library-limits";

/** The index that an arrow, Home or End key moves a card selection to, in a grid or a list. `tops` is each card's top
 *  edge in reading order; the column count is how many cards share the first card's row. Null means the key does
 *  nothing here: an unknown key, an edge, or no card focused (index -1). */
export function cardStep(key: string, index: number, tops: readonly number[]): number | null {
  const last = tops.length - 1;
  if (index < 0 || last < 0) return null;
  const first = tops[0];
  const columns = tops.filter((top) => Math.abs(top - first) < ROW_EPSILON).length;
  const to =
    key === "ArrowLeft"
      ? index - 1
      : key === "ArrowRight"
        ? index + 1
        : key === "ArrowUp"
          ? index - columns
          : key === "ArrowDown"
            ? index + columns
            : key === "Home"
              ? 0
              : key === "End"
                ? last
                : null;
  if (to === null || to < 0 || to > last || to === index) return null;
  return to;
}
