import { useEffect, useRef, useState } from "react";
import { createDebouncer, SEARCH_DEBOUNCE_MS, type Debouncer } from "../lib/debouncer";

/** The search field's one debounce timer (`docs/41` section 6): the component owns none. `run` is read when the timer
 *  fires, so it is always the latest closure; the timer is cleared on unmount. */
export function useDebouncedSearch(run: () => void, delayMs: number = SEARCH_DEBOUNCE_MS): Debouncer {
  const latest = useRef(run);
  useEffect(() => {
    latest.current = run;
  });
  const [debouncer] = useState(() => createDebouncer(() => latest.current(), delayMs));
  useEffect(() => () => debouncer.cancel(), [debouncer]);
  return debouncer;
}
