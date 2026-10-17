import type { AnimationPlaybackControls, MotionValue } from "framer-motion";
import type { AllotmentHandle } from "allotment";
import type { PaneKey } from "./shell";

export interface PaneLimits {
  readonly min: number;
  readonly max: number;
  readonly preferred: number;
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
  readonly minFor: (side: "left" | "right" | "bottom") => number;
  readonly maxFor: (side: "left" | "right" | "bottom") => number;
  readonly onRowChange: (sizes: readonly number[]) => void;
  readonly onRowDragStart: (sizes: readonly number[]) => void;
  readonly onRowDragEnd: (sizes: readonly number[]) => void;
  readonly onColumnChange: (sizes: readonly number[]) => void;
  readonly onColumnDragStart: (sizes: readonly number[]) => void;
  readonly onColumnDragEnd: (sizes: readonly number[]) => void;
}
