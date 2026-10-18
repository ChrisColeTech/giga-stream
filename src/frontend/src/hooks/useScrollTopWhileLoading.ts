import { useLayoutEffect, useRef } from "react";
import { resetsToTop } from "@/lib/window-rows";

/** The ref for a Library scroller, which is put back at the top as a first-page read begins and when the view changes
 *  (Rows, Grid and List are different lists: none inherits another's offset). Set explicitly rather than left to the
 *  browser clamping a shorter page. Runs before paint, ahead of the windowing hook's first measurement. */
export function useScrollTopWhileLoading<T extends HTMLElement>(loading: boolean, view: string) {
  const ref = useRef<T>(null);
  const previousView = useRef<string | null>(null);
  useLayoutEffect(() => {
    const top = resetsToTop({ loading, view, previousView: previousView.current });
    previousView.current = view;
    if (top && ref.current !== null) ref.current.scrollTop = 0;
  }, [loading, view]);
  return ref;
}
