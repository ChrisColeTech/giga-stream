import { AUDIT_AFTER_WRITE } from "@/constants/audit-limits";
import { stopRefused, stoppingSyncs } from "@/constants/progress-copy";
import { codeOf, sentenceOf } from "@/lib/playlist-flow-result";
import type { AppState } from "@/store/app-store";
import type { JobsService } from "./jobs";

export type StopSyncingStore = Pick<AppState, "jobProgress" | "serial" | "signedIn" | "say">;

export interface StopSyncingDeps {
  readonly service: Pick<JobsService, "stop">;
  readonly store: () => StopSyncingStore;
  readonly audit: { readonly reload: (limit?: number) => Promise<void> };
}

/** The statusbar's `Stop` (`44` section 4): `POST /api/jobs/:id/stop` for EVERY job the progress slice holds, at once. The
 *  runs end on their own and the stream reports each `finished`, so nothing is awaited beyond the calls themselves and
 *  nothing is polled. A job that had just ended (`job.not_running`) is not a failure; any other refusal is worded as the
 *  backend worded it, with how many were stopped. A second press while the calls run does nothing. */
export function createStopSyncing(deps: StopSyncingDeps): () => Promise<void> {
  const { service, store, audit } = deps;
  let pressed = false;
  return async () => {
    if (pressed) return;
    const serial = store().serial;
    const ids = store().jobProgress.live.map((entry) => entry.progress.jobId);
    if (ids.length === 0) return;
    pressed = true;
    try {
      const outcomes = await Promise.allSettled(ids.map((id) => service.stop(id)));
      if (!store().signedIn || store().serial !== serial) return;
      const refused = outcomes.flatMap((one) =>
        one.status === "rejected" && codeOf(one.reason) !== "job.not_running" ? [sentenceOf(one.reason)] : [],
      );
      const [first] = refused;
      if (first === undefined) store().say(stoppingSyncs(ids.length), "info", "Job");
      else store().say(stopRefused(refused.length, ids.length, first), "warn", "Job");
      void audit.reload(AUDIT_AFTER_WRITE);
    } finally {
      pressed = false;
    }
  };
}
