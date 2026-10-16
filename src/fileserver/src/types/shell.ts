import { z } from "zod";

/** `ShellState` (docs/03 section 3.3) and the pane inventory its sizes are validated against (`06` section 1.3). */
export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  maximized: boolean;
}

export interface ShellState {
  activeSurface: "live" | "library" | "player";
  paneVisibility: Record<string, boolean>;
  paneSizes: Record<string, number[]>;
  window?: WindowBounds;
}

export interface PaneBounds {
  axis: "width" | "height";
  min: number;
  /** `null` is "no maximum" (the flex centre stages). */
  max: number | null;
  collapsible: boolean;
}

/** Min/max in CSS pixels at zoom 1, the seven collapsible panes of `06` section 1.3. */
export const PANE_BOUNDS = {
  "live.settings": { axis: "width", min: 240, max: 400, collapsible: true },
  "live.channels": { axis: "width", min: 260, max: 440, collapsible: true },
  "library.rail": { axis: "width", min: 248, max: 420, collapsible: true },
  "library.filters": { axis: "width", min: 260, max: 420, collapsible: true },
  "player.browser": { axis: "width", min: 240, max: 420, collapsible: true },
  "player.inspector": { axis: "width", min: 288, max: 480, collapsible: true },
  "player.related": { axis: "height", min: 148, max: 280, collapsible: true },
} as const satisfies Record<string, PaneBounds>;

export type PaneId = keyof typeof PANE_BOUNDS;

export const PANE_IDS = Object.keys(PANE_BOUNDS) as PaneId[];

export function boundsOfPane(id: string): PaneBounds | null {
  return Object.hasOwn(PANE_BOUNDS, id) ? (PANE_BOUNDS as Record<string, PaneBounds>)[id] ?? null : null;
}

export const DEFAULT_SHELL_STATE: Readonly<ShellState> = Object.freeze({
  activeSurface: "library",
  paneVisibility: {},
  paneSizes: {},
});

const MAX_WINDOW_EXTENT = 100_000;

const WindowSchema = z
  .object({
    x: z.number().finite().min(-MAX_WINDOW_EXTENT).max(MAX_WINDOW_EXTENT),
    y: z.number().finite().min(-MAX_WINDOW_EXTENT).max(MAX_WINDOW_EXTENT),
    width: z.number().finite().min(1).max(MAX_WINDOW_EXTENT),
    height: z.number().finite().min(1).max(MAX_WINDOW_EXTENT),
    maximized: z.boolean(),
  })
  .strict();

const shape = {
  activeSurface: z.enum(["live", "library", "player"]),
  paneVisibility: z.record(z.string(), z.boolean()),
  paneSizes: z.record(z.string(), z.array(z.number().finite()).min(1).max(8)),
  window: WindowSchema,
};

type PaneContent = { paneVisibility?: Record<string, boolean>; paneSizes?: Record<string, number[]> };

/** Pane ids must be known; a size is 0 (collapsed, collapsible panes only) or within min/max. */
function checkPanes(value: PaneContent, ctx: z.RefinementCtx): void {
  const refuse = (path: string[], message: string): void =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
  for (const [id, visible] of Object.entries(value.paneVisibility ?? {})) {
    const bounds = boundsOfPane(id);
    if (!bounds) refuse(["paneVisibility", id], `Unknown pane "${id}".`);
    else if (!visible && !bounds.collapsible) refuse(["paneVisibility", id], `Pane "${id}" cannot be hidden.`);
  }
  for (const [id, sizes] of Object.entries(value.paneSizes ?? {})) {
    const bounds = boundsOfPane(id);
    if (!bounds) {
      refuse(["paneSizes", id], `Unknown pane "${id}".`);
      continue;
    }
    for (const size of sizes) {
      const collapsed = size === 0 && bounds.collapsible;
      const inRange = size >= bounds.min && (bounds.max === null || size <= bounds.max);
      if (!collapsed && !inRange) refuse(["paneSizes", id], `Pane "${id}" size ${size} is out of bounds.`);
    }
  }
}

/** What is stored and what the renderer receives. */
export const ShellStateSchema = z
  .object({ ...shape, window: shape.window.optional() })
  .strict()
  .superRefine(checkPanes);

/** `PATCH /api/shell-state` body: any subset of the state. */
export const ShellStatePatchSchema = z
  .object({ ...shape })
  .partial()
  .strict()
  .superRefine(checkPanes);

export type ShellStatePatch = z.infer<typeof ShellStatePatchSchema>;

/** Pane ids this build knows; a stored layout from an earlier build keeps only these. */
export function stripUnknownPanes(state: ShellState): ShellState {
  const keep = <T>(map: Record<string, T>): Record<string, T> =>
    Object.fromEntries(Object.entries(map).filter(([id]) => boundsOfPane(id) !== null));
  return {
    activeSurface: state.activeSurface,
    paneVisibility: keep(state.paneVisibility),
    paneSizes: keep(state.paneSizes),
    ...(state.window && { window: state.window }),
  };
}
