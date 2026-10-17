import type { AnimationPlaybackControls, MotionValue } from "framer-motion";
import type { AllotmentHandle } from "allotment";
import type { RefObject } from "react";

/** The three places a pane can sit on a surface. */
export type PaneSide = "left" | "right" | "bottom";

/** A pane's identity in the store and the tween engine: the surface and the side it sits on, joined by a dot. */
export type PaneKey = string;

export interface PaneLimits {
  readonly min: number;
  readonly max: number;
  readonly preferred: number;
}

/** One surface as the engine sees it: which side panes it has (`null` = none) and the floor of its centre. */
export interface SurfacePanes {
  readonly centerMin: number;
  readonly panes: Readonly<Record<PaneSide, PaneLimits | null>>;
}

/** THE LIMITS TABLE a program passes in: its surfaces by id, each with its panes' sizes. A surface or a pane that is
 *  not in it does not exist. */
export type PaneTable = Readonly<Record<string, SurfacePanes>>;

/** What the engine reads of a program's store, and the three things it asks the store to do. */
export interface PaneHostState {
  /** The shown surface; a falling pane is closed only on it. */
  readonly surface: string;
  /** Committed visibility per pane key; a pane never recorded reads open. */
  readonly open: Readonly<Partial<Record<string, boolean>>>;
  /** Committed size per pane key. */
  readonly sizes: Readonly<Partial<Record<string, number>>>;
  /** Bumped by every open change, so the engine travels for toggles and never for a drag. */
  readonly openVersion: number;
  /** Bumped when a saved layout is applied; a program without one leaves it out. */
  readonly hydrationVersion?: number;
  togglePane(side: PaneSide): void;
  say(sentence: string): void;
  commitSizes(patch: Readonly<Partial<Record<string, number>>>): void;
}

/** The store as the engine needs it: a zustand hook already satisfies it. */
export interface PaneHost {
  getState(): PaneHostState;
  subscribe(listener: (state: PaneHostState, previous: PaneHostState) => void): () => void;
}

/** Everything a program injects into the engine: its store, its limits table and what differs between the apps. */
export interface PaneEngine {
  readonly host: PaneHost;
  readonly table: PaneTable;
  /** The bottom pane's row stays above this height (the stage never collapses). */
  readonly stageMin: number;
  /** A hook run right after the splitter's, handed the surface's active flag; it returns the ref the workspace box is
   *  also written to. The interface repaints its videos here (a pane can change while a surface is hidden). */
  readonly useRepaint?: (active: boolean) => RefObject<HTMLDivElement | null>;
}

/** One pane's tween state: the committed size, the painted size (a motion value) and the travel in flight. */
export interface PaneMotion {
  committed: number;
  painted: MotionValue<number>;
  target: number;
  control: AnimationPlaybackControls | null;
  frame: number | null;
  animating: boolean;
}

export interface ExpectedResize {
  generation: number;
  sizes: readonly number[];
}

/** The shared collapse engine: state commits first, only the paint tweens. */
export interface PaneTweenApi {
  readonly paintOf: (key: PaneKey) => number;
  readonly minFor: (key: PaneKey) => number;
  readonly maxFor: (key: PaneKey) => number;
  readonly expectResize: (sizes: readonly number[]) => void;
  readonly acceptsResize: (sizes: readonly number[]) => boolean;
  readonly beginDrag: (key: PaneKey, value: number) => void;
  readonly noteDrag: (key: PaneKey, value: number) => void;
  readonly commitDrag: (key: PaneKey, value: number) => void;
}

/** What `useWorkspaceSplit` hands `WorkspaceSplit`: refs, defaults and the Allotment callbacks. */
export interface WorkspaceSplitApi {
  readonly boxRef: (node: HTMLDivElement | null) => void;
  readonly rowRef: (node: AllotmentHandle | null) => void;
  readonly columnRef: (node: AllotmentHandle | null) => void;
  readonly defaultRow: number[];
  readonly defaultColumn: number[];
  readonly minFor: (side: PaneSide) => number;
  readonly maxFor: (side: PaneSide) => number;
  readonly onRowChange: (sizes: readonly number[]) => void;
  readonly onRowDragStart: (sizes: readonly number[]) => void;
  readonly onRowDragEnd: (sizes: readonly number[]) => void;
  readonly onColumnChange: (sizes: readonly number[]) => void;
  readonly onColumnDragStart: (sizes: readonly number[]) => void;
  readonly onColumnDragEnd: (sizes: readonly number[]) => void;
}
