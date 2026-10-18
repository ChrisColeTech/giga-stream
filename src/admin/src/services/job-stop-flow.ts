import { AUDIT_AFTER_WRITE } from "@/constants/audit-limits";
import { jobStopping } from "@/constants/job-copy";
import type { JobField } from "@/lib/job-checks";
import { DROPPED, done, type FlowRefused, type FlowResult } from "@/lib/playlist-flow-result";
import { findById } from "@/lib/playlist-rows";
import type { JobsService } from "./jobs";
import type { AdminJob } from "./schemas/job-schema";
import type { JobStore } from "./job-flows";

export interface JobStopDeps {
  readonly service: Pick<JobsService, "stop">;
  readonly store: () => JobStore;
  readonly alive: (serial: number) => boolean;
  readonly upsert: (job: AdminJob) => void;
  /** A failed write: the notice, and a re-read when the failure may have changed the job (a refused stop may mean the
   *  run had just ended). */
  readonly failed: (error: unknown, field?: JobField) => FlowRefused<JobField>;
  readonly gone: () => FlowRefused<JobField>;
  readonly audit: { readonly reload: (limit?: number) => Promise<void> };
}

/** `Stop` on one job (`43` section 3.4a): the backend aborts the run at once and answers `202` with the job still
 *  `running`, so the notice is `Stopping <name>.` and the result (`stopped`) is read on Refresh: no timer, no polling. */
export function createStopFlow(deps: JobStopDeps): (id: number) => Promise<FlowResult<undefined, JobField>> {
  const { service, store, alive, upsert, failed, gone, audit } = deps;
  const pressed = new Set<number>();
  return async (id) => {
    if (findById(store().jobs.items, id) === undefined) return gone();
    if (pressed.has(id)) return done(undefined);
    pressed.add(id);
    const serial = store().serial;
    try {
      const answer = await service.stop(id);
      if (!alive(serial)) return DROPPED;
      upsert(answer);
      store().say(jobStopping(answer.name), "info", "Job");
      void audit.reload(AUDIT_AFTER_WRITE);
      return done(undefined);
    } catch (error: unknown) {
      return alive(serial) ? failed(error, "run") : DROPPED;
    } finally {
      pressed.delete(id);
    }
  };
}
