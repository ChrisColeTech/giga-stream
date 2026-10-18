import { useLayoutEffect, useState } from "react";
import { nearestScroller } from "../lib/pager-rules";

/** The client height of the page scroller around `node` (the nearest ancestor that scrolls vertically, else the
 *  document), followed with a ResizeObserver; no timers. 0 until measured. A hidden page (zero height) changes
 *  nothing, so a list keeps its size while its tab is away. */
export function useHostHeight(node: HTMLElement | null): number {
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    if (node === null) return undefined;
    const host = nearestScroller(node) ?? document.documentElement;
    const read = (): void => {
      const next = host.clientHeight;
      if (next > 0) setHeight(next);
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(read);
    observer?.observe(host);
    read();
    return () => observer?.disconnect();
  }, [node]);
  return height;
}
