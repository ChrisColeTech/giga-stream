import { useEffect, useRef } from "react";

/** The ref for a Library scroller, which is put back at the top as a first-page read begins: the new list starts at its
 *  top, set explicitly rather than left to the browser clamping a shorter page. */
export function useScrollTopWhileLoading<T extends HTMLElement>(loading: boolean) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (loading && ref.current !== null) ref.current.scrollTop = 0;
  }, [loading]);
  return ref;
}
