import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { rowEnds, type RowEnds } from "@/components/library/rows/rows-navigation";
import { shelfRange, type CardRange } from "@/lib/shelf-window";

export interface ShelfViewState {
  /** The cards to mount. */
  readonly range: CardRange;
  readonly ends: RowEnds;
  /** Measures the row again (on scroll). */
  readonly measure: () => void;
}

/** A shelf row's mounted range, its ends and its remembered position (`docs/33` sections 2.5 and 2.7). The state changes
 *  only when the range or an end changes, not on every scrolled pixel. A row without width (the surface hidden, a pane
 *  collapsed) is never measured, so its range and position are kept; when it has width again, or mounts again for the
 *  same plan, the remembered position is put back. No timers, no requests. */
export function useShelfView(
  row: RefObject<HTMLElement | null>,
  id: string,
  positions: Map<string, number>,
  count: number,
  landscape: boolean,
): ShelfViewState {
  const [range, setRange] = useState<CardRange>(() => shelfRange(null, landscape, count));
  const [ends, setEnds] = useState<RowEnds>({ atStart: true, atEnd: true });
  const restore = useRef<number | null>(positions.get(id) ?? null);
  const measured = useRef(false);
  const hidden = useRef(false);

  const measure = useCallback((): void => {
    const node = row.current;
    if (node === null) return;
    const clientWidth = node.clientWidth;
    if (clientWidth <= 0) {
      hidden.current = measured.current;
      return;
    }
    /* The remembered position goes back once the row is laid out at its full length (the pass after the first
       measurement), and again after a hidden row is shown, in case the browser dropped it. */
    if (hidden.current) restore.current = positions.get(id) ?? null;
    hidden.current = false;
    if (restore.current !== null && measured.current) {
      node.scrollLeft = restore.current;
      restore.current = null;
    }
    measured.current = true;
    const scrollLeft = restore.current ?? node.scrollLeft;
    if (restore.current === null) positions.set(id, scrollLeft);
    const next = shelfRange({ scrollLeft, clientWidth }, landscape, count);
    setRange((previous) => (previous.start === next.start && previous.end === next.end ? previous : next));
    const edge = rowEnds({ scrollLeft, clientWidth, scrollWidth: node.scrollWidth });
    setEnds((previous) => (previous.atStart === edge.atStart && previous.atEnd === edge.atEnd ? previous : edge));
  }, [row, id, positions, count, landscape]);

  /* After every render: new cards or spacers change the row's length. The setters keep equal values. */
  useLayoutEffect(() => measure());
  useLayoutEffect(() => {
    const node = row.current;
    if (node === null) return undefined;
    const observer = new ResizeObserver(() => measure());
    observer.observe(node);
    return () => observer.disconnect();
  }, [row, measure]);

  return { range, ends, measure };
}
