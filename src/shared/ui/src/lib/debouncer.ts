/** The pause after the last keystroke before a search runs (`docs/41` section 6, owner 2026-10-18). */
export const SEARCH_DEBOUNCE_MS = 200;

export interface Debouncer {
  /** A keystroke: the run is due in `delayMs`, and any earlier due run is cancelled (the one timer restarts). */
  readonly schedule: () => void;
  /** Runs now, whether or not one was due (Enter, the clear button); the due run, if any, is cancelled. */
  readonly now: () => void;
  /** Drops the due run without running it (unmount). */
  readonly cancel: () => void;
  readonly pending: () => boolean;
}

/** ONE one-shot timer, restarted by every keystroke: not polling (`01` section 4.3). Pure of React so a test can drive it
 *  with mock timers; `useDebouncedSearch` owns one per field and clears it on unmount. */
export function createDebouncer(run: () => void, delayMs: number = SEARCH_DEBOUNCE_MS): Debouncer {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const cancel = (): void => {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
  };
  return {
    schedule: () => {
      cancel();
      timer = setTimeout(() => {
        timer = null;
        run();
      }, delayMs);
    },
    now: () => {
      cancel();
      run();
    },
    cancel,
    pending: () => timer !== null,
  };
}
