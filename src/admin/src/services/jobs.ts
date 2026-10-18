import { notConnected } from "./not-connected";
import type { AdminJob } from "./schemas/job-schema";
import type { RecordService } from "./service-types";

/** The Jobs routes (`29` section 9.5): the shared four plus `run`. NOT CONNECTED: refuses until the Jobs worker wires it. */
export interface JobsService extends RecordService<AdminJob, number> {
  /** Runs the job now. */
  run: (id: number) => Promise<AdminJob>;
}

export const jobs: JobsService = {
  list: () => notConnected("jobs.list"),
  create: () => notConnected("jobs.create"),
  update: () => notConnected("jobs.update"),
  remove: () => notConnected("jobs.remove"),
  run: () => notConnected("jobs.run"),
};
