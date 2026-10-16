import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { AllotmentHandle } from "allotment";
import { SURFACES, limitsOf, paneKey } from "@/constants/surfaces";
import { useAppStore } from "@/store/app-store";
import type { WorkspaceSplitApi } from "@/types/panes";
import type { PaneKey, PaneSide, Surface } from "@/types/shell";
import { usePaneTween } from "./usePaneTween";

/* THE SPLITTER HOOK (ported from Giga Cut's useWorkspaceSplit): the only code allowed to own splitter refs or write
 * pane geometry. Allotment owns the splits; the collapse tween is the shared engine (`usePaneTween`). This hook keeps
 * only the surface's two-level geometry: a vertical [row | bottom] whose top pane holds the horizontal
 * [left | centre | right]. The centre takes what the painted panes leave, so the row fills its box exactly and the
 * bottom pane resizes against the whole row at once. A surface without a pane simply has no such entry. */
type SideKey = Exclude<PaneSide, "bottom">;
const SIDE_KEYS: readonly SideKey[] = ["left", "right"];

/* The work width (CSS px) below which the right pane collapses (06 section 1.3). Named here, not in constants/, so the
 * shell's own geometry stays in one file. */
const WORK_WIDTH_FLOOR = 1000;

/* The order side panes fall in as the work width shrinks: the right first, then the left. */
const FALL_ORDER: readonly SideKey[] = ["right", "left"];

/** The work width a side pane collapses below: the floor for the right; for the left, the line where the centre's
 *  minimum and the left pane's minimum no longer fit side by side. The centre never collapses. */
export function collapseLine(surface: Surface, side: SideKey): number {
  if (side === "right") return WORK_WIDTH_FLOOR;
  return SURFACES[surface].centerMin + (limitsOf(surface, "left")?.min ?? 0);
}

/** The side panes that fall when the work width goes from `previous` (null on the first measure) to `width`, right
 *  first. A pane falls only when the width crosses its line downward: a pane the user reopens under its line stays
 *  open until the window is widened past the line and narrowed again. */
export function sidesFalling(surface: Surface, previous: number | null, width: number): SideKey[] {
  return FALL_ORDER.filter((side) => {
    if (limitsOf(surface, side) === null) return false;
    const line = collapseLine(surface, side);
    return width < line && (previous === null || previous >= line);
  });
}

export function useWorkspaceSplit(surface: Surface): WorkspaceSplitApi {
  const config = SURFACES[surface];
  const row = useRef<AllotmentHandle | null>(null);
  const column = useRef<AllotmentHandle | null>(null);
  const box = useRef<HTMLDivElement | null>(null);
  const rowDragging = useRef(false);
  const columnDragging = useRef(false);
  const repaint = useRef<() => void>(() => {});
  const settle = useRef<() => void>(() => {});
  const lastWidth = useRef<number | null>(null);

  const sides = SIDE_KEYS.filter((side) => limitsOf(surface, side) !== null);
  const hasBottom = limitsOf(surface, "bottom") !== null;
  const keyOf = (side: PaneSide): PaneKey => paneKey(surface, side);
  const keys: PaneKey[] = [...sides, ...(hasBottom ? (["bottom"] as const) : [])].map(keyOf);
  const tween = usePaneTween(keys, () => repaint.current());

  const paint = (side: PaneSide): number => (limitsOf(surface, side) === null ? 0 : tween.paintOf(keyOf(side)));

  repaint.current = (): void => {
    const width = box.current?.clientWidth ?? 0;
    const height = box.current?.clientHeight ?? 0;
    const centre = Math.max(config.centerMin, width - paint("left") - paint("right"));
    const rowSizes = [...(sides.includes("left") ? [paint("left")] : []), centre, ...(sides.includes("right") ? [paint("right")] : [])];
    tween.expectResize(rowSizes);
    row.current?.resize(rowSizes);
    if (hasBottom) {
      const columnSizes = [Math.max(0, height - paint("bottom")), paint("bottom")];
      tween.expectResize(columnSizes);
      column.current?.resize(columnSizes);
    }
  };

  /* A falling pane is closed through the store's toggle, which writes the ACTIVE surface only, so a hidden surface's
   * panes wait until it is shown. A pane already closed is left alone, and the reason is said once on the notice line. */
  const fall = (side: SideKey): void => {
    const state = useAppStore.getState();
    if (state.surface !== surface || !(state.open[keyOf(side)] ?? true)) return;
    state.togglePane(side);
    state.say(`The ${side} pane collapsed to fit the window.`);
  };

  /* Runs on every size change of the surface's box: judge the width, then paint the panes. */
  settle.current = (): void => {
    const width = box.current?.clientWidth ?? 0;
    /* A hidden surface measures 0 and has no width to judge; its last width stays for when it is shown. */
    if (width > 0) {
      sidesFalling(surface, lastWidth.current, width).forEach(fall);
      lastWidth.current = width;
    }
    repaint.current();
  };

  /* THE FIRST LAYOUT IS PAINTED FROM THE STORE. Left alone, Allotment shares `defaultSizes` out by its own rule and a
   * pane can come up at its minimum instead of its preferred size. The observer is what lands it: Allotment measures
   * its container in its own ResizeObserver, which is registered first and so runs first, and a resize sent before
   * that measurement is clamped to a zero-sized split and lost. The same observer repaints, and judges the width, when
   * a hidden surface is shown and its box gets a size. */
  useLayoutEffect(() => repaint.current(), []);
  useEffect(() => {
    const frame = requestAnimationFrame(() => settle.current());
    const observer = new ResizeObserver(() => settle.current());
    if (box.current) {
      observer.observe(box.current);
      const centre = box.current.querySelector(".pane-center");
      if (centre !== null) observer.observe(centre);
    }
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  /* Row index -> pane key: [left?, centre, right?]; the centre has no key and never persists a size. */
  const rowKeys: Array<PaneKey | null> = [
    ...(sides.includes("left") ? [keyOf("left")] : []),
    null,
    ...(sides.includes("right") ? [keyOf("right")] : []),
  ];

  const noteRow = useCallback(
    (sizes: readonly number[]): void => {
      if (tween.acceptsResize(sizes) || !rowDragging.current) return;
      rowKeys.forEach((key, index) => {
        const size = sizes[index];
        if (key !== null && typeof size === "number") tween.noteDrag(key, size);
      });
    },
    [tween],
  );

  const commitRow = useCallback(
    (sizes: readonly number[]): void => {
      rowDragging.current = false;
      const patch: Partial<Record<PaneKey, number>> = {};
      rowKeys.forEach((key, index) => {
        const size = sizes[index];
        if (key !== null && typeof size === "number") {
          tween.commitDrag(key, size);
          patch[key] = size;
        }
      });
      useAppStore.getState().commitSizes(patch);
    },
    [tween],
  );

  return {
    boxRef: (node) => {
      box.current = node;
    },
    rowRef: (node) => {
      row.current = node;
    },
    columnRef: (node) => {
      column.current = node;
    },
    defaultRow: [
      ...(sides.includes("left") ? [limitsOf(surface, "left")?.preferred ?? 0] : []),
      config.centerMin,
      ...(sides.includes("right") ? [limitsOf(surface, "right")?.preferred ?? 0] : []),
    ],
    defaultColumn: [10_000, limitsOf(surface, "bottom")?.preferred ?? 0],
    /* A closed pane's sash cannot drag it open: min 0, max 0 until a toggle says otherwise (a drag never changes open
     * state). The min also drops to 0 for the length of a tween in EITHER direction: a reopening pane travels from 0
     * up to its min, and the min must not clamp the travelling value. */
    minFor: (side) => tween.minFor(keyOf(side)),
    maxFor: (side) => tween.maxFor(keyOf(side)),
    onRowChange: noteRow,
    onColumnChange: (sizes) => {
      if (tween.acceptsResize(sizes) || !columnDragging.current) return;
      const size = sizes[1];
      if (typeof size === "number") tween.noteDrag(keyOf("bottom"), size);
    },
    onRowDragStart: (sizes) => {
      rowDragging.current = true;
      rowKeys.forEach((key, index) => {
        const size = sizes[index];
        if (key !== null && typeof size === "number") tween.beginDrag(key, size);
      });
    },
    onColumnDragStart: (sizes) => {
      columnDragging.current = true;
      const size = sizes[1];
      if (typeof size === "number") tween.beginDrag(keyOf("bottom"), size);
    },
    onRowDragEnd: commitRow,
    onColumnDragEnd: (sizes) => {
      columnDragging.current = false;
      const size = sizes[1];
      if (typeof size === "number") {
        tween.commitDrag(keyOf("bottom"), size);
        useAppStore.getState().commitSizes({ [keyOf("bottom")]: size });
      }
    },
  };
}
