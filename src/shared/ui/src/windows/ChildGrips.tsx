import type { DragHandlers } from "../hooks/useChildWindowBox";
import type { Edge } from "../lib/child-bounds";
import { GRIP } from "../lib/child-metrics";

/** Where each grip sits and which cursor it wears: four edges and four corners, each a few points wide, registered
 *  before the content so a control at an edge still wins. A press on one resizes the window in that direction. */
const GRIPS: ReadonlyArray<{ edge: Edge; style: React.CSSProperties; cursor: string }> = [
  { edge: "n", style: { top: 0, left: GRIP, right: GRIP, height: GRIP }, cursor: "ns-resize" },
  { edge: "s", style: { bottom: 0, left: GRIP, right: GRIP, height: GRIP }, cursor: "ns-resize" },
  { edge: "w", style: { left: 0, top: GRIP, bottom: GRIP, width: GRIP }, cursor: "ew-resize" },
  { edge: "e", style: { right: 0, top: GRIP, bottom: GRIP, width: GRIP }, cursor: "ew-resize" },
  { edge: "nw", style: { top: 0, left: 0, width: GRIP, height: GRIP }, cursor: "nwse-resize" },
  { edge: "ne", style: { top: 0, right: 0, width: GRIP, height: GRIP }, cursor: "nesw-resize" },
  { edge: "sw", style: { bottom: 0, left: 0, width: GRIP, height: GRIP }, cursor: "nesw-resize" },
  { edge: "se", style: { bottom: 0, right: 0, width: GRIP, height: GRIP }, cursor: "nwse-resize" },
];

export function ChildGrips({ grip }: { grip: (edge: Edge) => DragHandlers }) {
  return (
    <>
      {GRIPS.map(({ edge, style, cursor }) => (
        <div key={edge} data-grip={edge} aria-hidden className="absolute z-10" style={{ ...style, cursor }} {...grip(edge)} />
      ))}
    </>
  );
}
