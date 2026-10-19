import { request } from "./api";
import { JobDeletedSchema, JobListLenientSchema, JobSchema, type AdminJob, type JobList } from "./schemas/job-schema";
import type { RecordService } from "./service-types";

/** The Jobs routes (`03` section 7.2c, `43` section 3.4), REAL: `GET`, `POST /api/admin/jobs` (catalog jobs only: a
 *  playlist's job is made with the playlist), `PATCH`, `DELETE /api/admin/jobs/:id` (a playlist's job is refused: it
 *  goes with the playlist) and `POST /api/admin/jobs/:id/run`. A patch's `config` is merged by the backend over the
 *  job's own; `type` never changes. `run` STARTS the job and answers `202` with the job as it stands (`running: true`);
 *  the result is read on a refresh, never awaited. The refusals (`409 sync.busy`, `422 job.disabled` with its reason,
 *  `503 tmdb.unavailable`) arrive as `ApiError`s. The list is read row by row. */
export interface JobsService extends RecordService<AdminJob, number, JobList> {
  /** Starts the job now; no body. */
  run: (id: number) => Promise<AdminJob>;
  /** Stops the running job (`POST /api/admin/jobs/:id/stop`, `202`): it answers `running: true` until the run notices, and the
   *  result (`stopped`) is read on a refresh. `409 job.not_running` when idle; playlist and catalog jobs alike are
   *  stoppable (`44` section 3.2). */
  stop: (id: number) => Promise<AdminJob>;
}

const path = (id: number): string => `/api/admin/jobs/${encodeURIComponent(String(id))}`;

async function list(): Promise<JobList> {
  const answer = await request("/api/admin/jobs", JobListLenientSchema, { area: "Job" });
  const items: AdminJob[] = [];
  for (const row of answer.items) {
    const parsed = JobSchema.safeParse(row);
    if (parsed.success) items.push(parsed.data);
  }
  return { items, unreadable: answer.items.length - items.length };
}

export const jobs: JobsService = {
  list,
  create: (input) => request("/api/admin/jobs", JobSchema, { method: "POST", body: input, area: "Job" }),
  update: (id, patch) => request(path(id), JobSchema, { method: "PATCH", body: patch, area: "Job" }),
  remove: (id) => request(path(id), JobDeletedSchema, { method: "DELETE", area: "Job" }),
  run: (id) => request(`${path(id)}/run`, JobSchema, { method: "POST", area: "Job" }),
  stop: (id) => request(`${path(id)}/stop`, JobSchema, { method: "POST", area: "Job" }),
};
