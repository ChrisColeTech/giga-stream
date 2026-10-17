import { limitsOf, surfaceOf } from "./pane-limits";
import type { PaneSide, PaneTable } from "./pane-types";

/* The width rule for the side panes (`06` section 1.3), pure, so it is tested without a layout. */
export type SideKey = Exclude<PaneSide, "bottom">;

/** The work width (CSS px) below which the right pane collapses. */
const WORK_WIDTH_FLOOR = 1000;

/** The order side panes fall in as the work width shrinks: the right first, then the left. */
const FALL_ORDER: readonly SideKey[] = ["right", "left"];

/** The work width a side pane collapses below: the floor for the right; for the left, the line where the centre's
 *  minimum and the left pane's minimum no longer fit side by side. The centre never collapses. */
export function collapseLine(table: PaneTable, surface: string, side: SideKey): number {
  if (side === "right") return WORK_WIDTH_FLOOR;
  return surfaceOf(table, surface).centerMin + (limitsOf(table, surface, "left")?.min ?? 0);
}

/** The side panes that fall when the work width goes from `previous` (null on the first measure) to `width`, right
 *  first. A pane falls only when the width crosses its line downward: a pane the user reopens under its line stays
 *  open until the window is widened past the line and narrowed again. */
export function sidesFalling(table: PaneTable, surface: string, previous: number | null, width: number): SideKey[] {
  return FALL_ORDER.filter((side) => {
    if (limitsOf(table, surface, side) === null) return false;
    const line = collapseLine(table, surface, side);
    return width < line && (previous === null || previous >= line);
  });
}

/** The side panes whose line the work width crosses upward, going from `previous` to `width`: the ones a fall closed
 *  come back here. */
export function sidesRising(table: PaneTable, surface: string, previous: number | null, width: number): SideKey[] {
  return FALL_ORDER.filter((side) => {
    if (limitsOf(table, surface, side) === null || previous === null) return false;
    const line = collapseLine(table, surface, side);
    return width >= line && previous < line;
  });
}
