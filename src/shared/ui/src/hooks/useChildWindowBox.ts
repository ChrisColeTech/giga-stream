import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { clampSize, inside, limitsOf, maximizedBox, openBox, resized, roomOf } from "../lib/child-bounds";
import type { Edge } from "../lib/child-bounds";
import { toggleMaximized } from "../lib/child-memory";
import type { ChildMemory } from "../lib/child-memory";
import type { Box, ChildSpec } from "../lib/child-types";
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
 *  pointer move. A resize of the main window re-clamps the window into the room it now has. `memory` is the program's
 *  store of where windows were; it is read once, as the window opens. */
export function useChildWindowBox(spec: ChildSpec, memory: ChildMemory) {
  const viewport = useViewport();
  const room = useMemo(() => roomOf(viewport), [viewport]);
  const limits = useMemo(() => limitsOf(spec, room), [spec, room]);
  const [box, setBox] = useState<Box>(() => openBox(spec, room, memory.recall(spec.key)));
  /* Maximized (`36` section 8.4): the flag is remembered for the run; `box` stays the NORMAL box underneath, so Restore
   * goes back to it exactly, and the shown box is derived from the viewport so a resize keeps it fitted. */
  const [maximized, setMaximized] = useState<boolean>(() => spec.maximizable !== false && memory.maximized?.(spec.key) === true);
  const gesture = useRef<Gesture | null>(null);
  const live = useRef(box);
  live.current = box;
  const toggle = (): void => {
    if (spec.maximizable !== false) setMaximized(toggleMaximized(memory, spec.key, live.current, maximized));
  };

  useEffect(() => {
    setBox((now) => {
      const size = clampSize(now, limits);
      return { ...inside(now.x, now.y, size, room), ...size };
    });
  }, [room, limits]);

  const begin = (edge: Gesture["edge"]) => (event: ReactPointerEvent<HTMLElement>) => {
    if (maximized || event.button !== 0 || (event.target as HTMLElement).closest("button") !== null) return;
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
    memory.remember(spec.key, live.current);
  };

  const handlers = (edge: Gesture["edge"]): DragHandlers => ({
    onPointerDown: begin(edge),
    onPointerMove: track,
    onPointerUp: end,
  });

  const shown = useMemo(() => (maximized ? maximizedBox(viewport) : box), [maximized, viewport, box]);
  return { box: shown, maximized, toggleMaximized: toggle, limits, move: handlers("move"), grip: (edge: Edge) => handlers(edge) };
}
