import { NO_LIVE, fromSnapshot, withProgress, withoutJob, type LiveJob } from "@/lib/live-jobs";
import type { JobProgress } from "@/services/schemas/job-event-schema";
import type { SliceGet, SliceSet } from "./slices/slice-host";

/* The live job progress, a slice of the one store (`44` section 4). Facts only: no promise, no timer, no stream. The
 * stream's consumer (`services/job-events.ts`) writes it; the statusbar and `Stop` read it - "any job running" and its
 * count come from here and never from `work.syncing`, which the bulk runners write. Nothing is stored: it is empty after a
 * stream ends and after a sign-out. `jobEventsTick` is how a list's Refresh asks the hook to reopen the stream. */
export interface JobProgressSlice {
  jobProgress: { readonly live: readonly LiveJob[] };
  jobEventsTick: number;
  /** A `snapshot` frame: exactly these jobs run. */
  jobProgressSnapshot: (running: readonly JobProgress[]) => void;
  jobProgressUpdate: (progress: JobProgress) => void;
  jobProgressFinished: (jobId: number) => void;
  /** The stream ended or the session did: no job is known to run. */
  jobProgressClear: () => void;
  /** Ask for a fresh stream (a Refresh, a window focus). */
  jobEventsReopen: () => void;
}

export function createJobProgressSlice(set: SliceSet<JobProgressSlice>, get: SliceGet<JobProgressSlice>): JobProgressSlice {
  const live = (): readonly LiveJob[] => get().jobProgress.live;
  const put = (next: readonly LiveJob[]): void => set({ jobProgress: { live: next } });
  return {
    jobProgress: { live: NO_LIVE },
    jobEventsTick: 0,
    jobProgressSnapshot: (running) => put(fromSnapshot(live(), running)),
    jobProgressUpdate: (progress) => put(withProgress(live(), progress)),
    jobProgressFinished: (jobId) => put(withoutJob(live(), jobId)),
    jobProgressClear: () => {
      if (live().length > 0) put(NO_LIVE);
    },
    jobEventsReopen: () => set({ jobEventsTick: get().jobEventsTick + 1 }),
  };
}
