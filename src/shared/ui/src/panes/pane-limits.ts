import type { PaneKey, PaneLimits, PaneSide, PaneTable, SurfacePanes } from "./pane-types";

/** What a surface the table does not know has: no side panes and no centre floor. */
const NO_SURFACE: SurfacePanes = { centerMin: 0, panes: { left: null, right: null, bottom: null } };

/** The three sides a key can end in. */
export const SIDES: readonly PaneSide[] = ["left", "bottom", "right"];

/** The surface's row of the table. */
export const surfaceOf = (table: PaneTable, surface: string): SurfacePanes => table[surface] ?? NO_SURFACE;

/** A pane's key: its surface and its side. */
export const paneKey = (surface: string, side: PaneSide): PaneKey => `${surface}.${side}`;

/** The limits of one pane; a pane the surface does not have has none. */
export function limitsOf(table: PaneTable, surface: string, side: PaneSide): PaneLimits | null {
  return surfaceOf(table, surface).panes[side];
}

/** The limits behind a pane key. The engine only ever holds keys of panes that exist. */
export function limitsOfKey(table: PaneTable, key: PaneKey): PaneLimits {
  const [surface = "", side = ""] = key.split(".");
  const found = SIDES.find((candidate) => candidate === side);
  return (found === undefined ? null : limitsOf(table, surface, found)) ?? { min: 0, max: 0, preferred: 0 };
}
