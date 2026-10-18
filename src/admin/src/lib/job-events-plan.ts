import type { Tab } from "@/types/shell";

/* When the job-event stream opens, reopens and ends (`44` section 4), as pure decisions the hook and the service act on.
 * Nothing here waits: no interval, no retry loop. The stream is opened after sign-in and reopened when the access token
 * changes, on window focus and on a list's Refresh - and at no other moment. */

/** The tabs whose lists a run's end (or a lost stream) makes old. */
export const STALE_ON_RUN_END: readonly Tab[] = ["jobs", "playlists", "channels"];

/** What names one open stream: null while there is nothing to stream, else a key that changes exactly when the stream must
 *  be reopened (a new token, a Refresh or a focus bumped `tick`). */
export function streamKeyOf(signedIn: boolean, accessToken: string | null, tick: number): string | null {
  return signedIn && accessToken !== null ? `${accessToken}:${tick}` : null;
}

export interface StreamEndPlan {
  /** Forget the live progress: nothing is known to run. */
  readonly clear: boolean;
  readonly stale: readonly Tab[];
}

/** A stream that ended by itself (the server closed it, the network dropped, it could not open) leaves the lists old and
 *  the progress unknown. One this app aborted (a reopen, a sign-out) leaves everything for the next stream's snapshot. */
export const streamEndPlan = (abortedByApp: boolean): StreamEndPlan =>
  abortedByApp ? { clear: false, stale: [] } : { clear: true, stale: STALE_ON_RUN_END };
