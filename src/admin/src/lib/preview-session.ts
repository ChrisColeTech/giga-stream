/* The Preview window's reads (`36` section 8), with the read injected so a test counts it: ONE read of the channels when
 * the window opens, ONE more for each `Retry`, and nothing else: no timer, no poll. After a retry's read the attempt is
 * raised, so the player attaches again even when the address did not change. */

export interface PreviewSessionState {
  /** A read is running: nothing is attached and the stage wears its skeleton. */
  readonly reading: boolean;
  /** Raised after every retry's read. */
  readonly attempt: number;
}

export const SESSION_START: PreviewSessionState = { reading: true, attempt: 0 };

export interface PreviewSession {
  open(): Promise<void>;
  retry(): Promise<void>;
  /** The window closed: a late read changes nothing. */
  close(): void;
}

export function createPreviewSession(
  read: () => Promise<unknown>,
  onState: (state: PreviewSessionState) => void,
): PreviewSession {
  let state = SESSION_START;
  let open = true;
  const set = (next: PreviewSessionState): void => {
    state = next;
    if (open) onState(next);
  };
  async function readOnce(raise: boolean): Promise<void> {
    if (state.reading && state !== SESSION_START) return;
    set({ ...state, reading: true });
    await read().catch(() => undefined);
    set({ reading: false, attempt: state.attempt + (raise ? 1 : 0) });
  }
  return {
    open: () => readOnce(false),
    retry: () => readOnce(true),
    close: () => {
      open = false;
    },
  };
}
