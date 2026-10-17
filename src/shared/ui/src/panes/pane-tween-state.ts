import { limitsOfKey } from "./pane-limits";
import type { PaneHostState, PaneKey, PaneLimits, PaneTable } from "./pane-types";

/** Two lists of sizes are the same layout when every size is within a pixel of its partner. */
export const near = (left: readonly number[], right: readonly number[]): boolean =>
  left.length === right.length && left.every((value, index) => Math.abs(value - (right[index] ?? Number.NaN)) <= 1);

/** Where a pane rests: the size it was committed at (else its preferred size), and what is painted for it, which is
 *  that size while it is open and nothing while it is closed. */
export function restingSize(
  state: Pick<PaneHostState, "open" | "sizes">,
  table: PaneTable,
  key: PaneKey,
): { readonly committed: number; readonly value: number } {
  const committed = state.sizes[key] ?? limitsOfKey(table, key).preferred;
  return { committed, value: state.open[key] ? committed : 0 };
}

/** The smallest size Allotment may clamp a pane to: its minimum once it is open, at rest and painted at least that
 *  large, else nothing. The minimum also drops to 0 for the length of a tween in EITHER direction: a reopening pane
 *  travels from 0 up to its minimum, and the minimum must not clamp the travelling value. */
export function minAllowed(limits: PaneLimits, open: boolean | undefined, animating: boolean, painted: number): number {
  return open && !animating && painted >= limits.min ? limits.min : 0;
}

/** The largest size Allotment may clamp a pane to: its maximum while it is open or travelling, else nothing, so a
 *  closed pane's sash cannot drag it open. */
export function maxAllowed(limits: PaneLimits, open: boolean | undefined, animating: boolean): number {
  return open || animating ? limits.max : 0;
}
