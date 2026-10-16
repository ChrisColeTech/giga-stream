import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { clampSize, inside, limitsOf, openBox, resized, roomOf } from "@/lib/child-bounds";
import type { Edge } from "@/lib/child-bounds";
import { useAppStore } from "@/store/app-store";
import type { Box, ChildSpec } from "@/types/child-window";
import { useViewport } from "./useViewport";

interface Gesture {
  readonly edge: Edge | "move";
  readonly pointer: { readonly x: number; readonly y: number };
  readonly start: Box;
}

/** The pointer handlers one draggable region (the header, or a grip) wears. */
export interface DragHandlers {
  readonly onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  readonly onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  readonly onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
}

/** Where a child window is and how large, and the gestures that change it. It opens where it last was (put back inside
 *  the main window, which may have moved or shrunk) or placed by its kind; the header moves it, the grips resize it,
 *  and both are held between the limits and inside the room. Only the end of a gesture is remembered, never each
 *  pointer move. A resize of the main window re-clamps the window into the room it now has. */
export function useChildWindowBox(spec: ChildSpec) {
  const viewport = useViewport();
  const room = useMemo(() => roomOf(viewport), [viewport]);
  const limits = useMemo(() => limitsOf(spec, room), [spec, room]);
  const remember = useAppStore((state) => state.rememberChild);
  const [box, setBox] = useState<Box>(() => openBox(spec, room, useAppStore.getState().childBounds[spec.key]));
  const gesture = useRef<Gesture | null>(null);
  const live = useRef(box);
  live.current = box;

  useEffect(() => {
    setBox((now) => {
      const size = clampSize(now, limits);
      return { ...inside(now.x, now.y, size, room), ...size };
    });
  }, [room, limits]);

  const begin = (edge: Gesture["edge"]) => (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button") !== null) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { edge, pointer: { x: event.clientX, y: event.clientY }, start: live.current };
  };

  const track = (event: ReactPointerEvent<HTMLElement>): void => {
    const now = gesture.current;
    if (now === null) return;
    const dx = event.clientX - now.pointer.x;
    const dy = event.clientY - now.pointer.y;
    if (now.edge === "move") {
      const moved = inside(now.start.x + dx, now.start.y + dy, now.start, room);
      setBox({ ...moved, width: now.start.width, height: now.start.height });
    } else {
      setBox(resized(now.start, now.edge, dx, dy, limits, room));
    }
  };

  const end = (event: ReactPointerEvent<HTMLElement>): void => {
    if (gesture.current === null) return;
    gesture.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    remember(spec.key, live.current);
  };

  const handlers = (edge: Gesture["edge"]): DragHandlers => ({
    onPointerDown: begin(edge),
    onPointerMove: track,
    onPointerUp: end,
  });

  return { box, limits, move: handlers("move"), grip: (edge: Edge) => handlers(edge) };
}
