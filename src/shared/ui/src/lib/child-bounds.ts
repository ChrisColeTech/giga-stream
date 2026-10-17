import { BORDER, CORNER_OFFSET, HEADER_GAP, INSET, OPEN_SHARE, TITLEBAR_HEIGHT, TITLE_HEIGHT } from "./child-metrics";
import type { Box, ChildLimits, ChildSpec, Size } from "./child-types";

/** What the window's padding and border add around its content on each axis. */
const CHROME = 2 * (INSET + BORDER);

/** The outer size of a window with `width` of content and `body` under its header. */
export function sized(width: number, body: number): Size {
  return { width: width + CHROME, height: TITLE_HEIGHT + HEADER_GAP + body + CHROME };
}

/** The main window as a child sees it: the whole viewport. A window never covers the titlebar, so the room it lives in
 *  starts under it. */
export function roomOf(viewport: Size): Box {
  return { x: 0, y: TITLEBAR_HEIGHT, width: viewport.width, height: Math.max(0, viewport.height - TITLEBAR_HEIGHT) };
}

/** The sizes a window may take. `max` is the room; `min` is the surface's least, capped to `max`; `open` is the content
 *  size, at most `OPEN_SHARE` of the room and never below `min`. */
export function limitsOf(spec: ChildSpec, room: Box): ChildLimits {
  const max = { width: room.width, height: room.height };
  const least = sized(spec.minWidth, spec.minBody);
  const min = { width: Math.min(least.width, max.width), height: Math.min(least.height, max.height) };
  const want = sized(spec.width, spec.body);
  const open = {
    width: Math.max(min.width, Math.min(want.width, Math.floor(room.width * OPEN_SHARE))),
    height: Math.max(min.height, Math.min(want.height, Math.floor(room.height * OPEN_SHARE))),
  };
  return { open, min, max };
}

/** `size` clamped between the limits. */
export function clampSize(size: Size, limits: ChildLimits): Size {
  return {
    width: Math.max(limits.min.width, Math.min(size.width, limits.max.width)),
    height: Math.max(limits.min.height, Math.min(size.height, limits.max.height)),
  };
}

/** The top-left for a window of `size`, moved the least that puts the whole window inside `room`. */
export function inside(x: number, y: number, size: Size, room: Box): { readonly x: number; readonly y: number } {
  return {
    x: Math.max(room.x, Math.min(x, room.x + room.width - size.width)),
    y: Math.max(room.y, Math.min(y, room.y + room.height - size.height)),
  };
}

/** Where a window of `size` goes the first time, by its place, wholly inside `room`. */
export function placeAt(spec: ChildSpec, size: Size, room: Box): { readonly x: number; readonly y: number } {
  if (spec.place === "corner") return inside(room.x + CORNER_OFFSET.x, room.y + CORNER_OFFSET.y, size, room);
  return inside(room.x + (room.width - size.width) / 2, room.y + (room.height - size.height) / 2, size, room);
}

/** The rectangle a window opens in: where and how large it last was (clamped to what is allowed now, and put back
 *  inside the room, which may have moved or shrunk), else placed by its kind at the size its content wants. */
export function openBox(spec: ChildSpec, room: Box, kept: Box | undefined): Box {
  const limits = limitsOf(spec, room);
  const size = clampSize(kept === undefined ? limits.open : { width: kept.width, height: kept.height }, limits);
  const at = kept === undefined ? placeAt(spec, size, room) : inside(kept.x, kept.y, size, room);
  return { ...at, ...size };
}

/** The edges a resize drags: any of the four sides, as the grips name them. */
export type Edge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

/** `box` after dragging `edge` by (`dx`, `dy`), held between the limits and inside the room. A west or north drag moves
 *  the opposite edge's anchor, not the window, so the far side stays where it was. */
export function resized(box: Box, edge: Edge, dx: number, dy: number, limits: ChildLimits, room: Box): Box {
  let { x, y, width, height } = box;
  if (edge.includes("e")) width = Math.max(limits.min.width, Math.min(box.width + dx, limits.max.width, room.x + room.width - box.x));
  if (edge.includes("s")) height = Math.max(limits.min.height, Math.min(box.height + dy, limits.max.height, room.y + room.height - box.y));
  if (edge.includes("w")) {
    const right = box.x + box.width;
    width = Math.max(limits.min.width, Math.min(box.width - dx, limits.max.width, right - room.x));
    x = right - width;
  }
  if (edge.includes("n")) {
    const bottom = box.y + box.height;
    height = Math.max(limits.min.height, Math.min(box.height - dy, limits.max.height, bottom - room.y));
    y = bottom - height;
  }
  return { x, y, width, height };
}
