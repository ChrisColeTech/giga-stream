import { useLayoutEffect, useState } from "react";

/** The element's content width (`clientWidth`: the scrollbar and its gutter are not in it), kept by a ResizeObserver, no
 *  timers. 0 until it is measured, in server rendering, and while the element is hidden: a 0 width changes nothing, so
 *  the last real width stays. The element is held in state by the caller (a callback ref), never read once from a ref. */
export function useElementWidth(element: HTMLElement | null): number {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (element === null) return undefined;
    const read = (): void => {
      const next = element.clientWidth;
      if (next > 0) setWidth(next);
    };
    read();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(read);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return width;
}
