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

export function useWorkspaceSplit(surface: Surface): WorkspaceSplitApi {
  const config = SURFACES[surface];
  const row = useRef<AllotmentHandle | null>(null);
  const column = useRef<AllotmentHandle | null>(null);
  const box = useRef<HTMLDivElement | null>(null);
  const rowDragging = useRef(false);
  const columnDragging = useRef(false);
  const repaint = useRef<() => void>(() => {});

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

  /* THE FIRST LAYOUT IS PAINTED FROM THE STORE. Left alone, Allotment shares `defaultSizes` out by its own rule and a
   * pane can come up at its minimum instead of its preferred size. The observer is what lands it: Allotment measures
   * its container in its own ResizeObserver, which is registered first and so runs first, and a resize sent before
   * that measurement is clamped to a zero-sized split and lost. The same observer repaints when a hidden surface is
   * shown and its box gets a size. */
  useLayoutEffect(() => repaint.current(), []);
  useEffect(() => {
    const frame = requestAnimationFrame(() => repaint.current());
    const observer = new ResizeObserver(() => repaint.current());
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
