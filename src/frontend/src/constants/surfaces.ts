import type { PaneLimits } from "@/types/panes";
import type { PaneKey, PaneSide, Surface } from "@/types/shell";

/** One surface: which side panes it has (`null` = none, its titlebar toggle renders disabled, never hidden) and
 *  the floor of its centre. Sizes are the pane inventory of `06` section 2.3. */
export interface SurfaceConfig {
  readonly label: string;
  readonly panes: Readonly<Record<PaneSide, PaneLimits | null>>;
  readonly centerMin: number;
}

export const SURFACES: Readonly<Record<Surface, SurfaceConfig>> = {
  live: {
    label: "Live",
    centerMin: 480,
    panes: {
      left: { min: 240, max: 400, preferred: 288 },
      right: { min: 260, max: 440, preferred: 320 },
      bottom: null,
    },
  },
  library: {
    label: "Library",
    centerMin: 520,
    panes: {
      left: { min: 248, max: 420, preferred: 288 },
      right: { min: 260, max: 420, preferred: 300 },
      bottom: null,
    },
  },
  player: {
    label: "Player",
    centerMin: 520,
    panes: {
      left: { min: 190, max: 380, preferred: 236 },
      right: { min: 220, max: 420, preferred: 280 },
      bottom: { min: 60, max: 280, preferred: 210 },
    },
  },
};

export const SURFACE_ORDER: readonly Surface[] = ["live", "library", "player"];

export const DEFAULT_SURFACE: Surface = "library";

/** The bottom pane of a surface stays above this height (the stage never collapses). */
export const STAGE_MIN_HEIGHT = 240;

export const paneKey = (surface: Surface, side: PaneSide): PaneKey => `${surface}.${side}`;

export const SIDES: readonly PaneSide[] = ["left", "bottom", "right"];

/** The limits of one pane; a pane the surface does not have has none. */
export function limitsOf(surface: Surface, side: PaneSide): PaneLimits | null {
  return SURFACES[surface].panes[side];
}

/** The limits behind a pane key. The tween engine only ever holds keys of panes that exist. */
export function limitsOfKey(key: PaneKey): PaneLimits {
  const [surface, side] = key.split(".") as [Surface, PaneSide];
  return limitsOf(surface, side) ?? { min: 0, max: 0, preferred: 0 };
}
