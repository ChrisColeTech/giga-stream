import { request } from "./api";
import { JobDeletedSchema, JobListLenientSchema, JobSchema, type AdminJob, type JobList } from "./schemas/job-schema";
import type { RecordService } from "./service-types";

/** A playlist job's run may override its own `dryRun` and `prune` once (`29` section 9.5). */
export interface JobRunOverride {
  readonly dryRun?: boolean;
  readonly prune?: boolean;
}

/** The Jobs routes (`29` section 9.5, `38` section 4.1), REAL: `GET`, `POST /api/jobs`, `PATCH`, `DELETE
 *  /api/jobs/:id` and `POST /api/jobs/:id/run`. A patch's `config` is merged by the backend over the job's own; `type`
 *  never changes. `run` is widened (additive) to `run(id, override?)`: a playlist job is awaited and its `202` already
 *  carries the new outcome and counts; a catalog job is started and its `202` says `running: true`. The refusals
 *  (`409 sync.busy`, `422 job.disabled` with its reason, `503 tmdb.unavailable`, `503 playlist.unreachable`, `422
 *  playlist.invalid`, `409 playlist.busy`) arrive as `ApiError`s. The list is read row by row. */
export interface JobsService extends RecordService<AdminJob, number, JobList> {
  /** Runs the job now; a playlist job's override is sent once, a catalog job sends no body. */
  run: (id: number, override?: JobRunOverride) => Promise<AdminJob>;
}

const path = (id: number): string => `/api/jobs/${encodeURIComponent(String(id))}`;

async function list(): Promise<JobList> {
  const answer = await request("/api/jobs", JobListLenientSchema, { area: "Job" });
  const items: AdminJob[] = [];
  for (const row of answer.items) {
    const parsed = JobSchema.safeParse(row);
    if (parsed.success) items.push(parsed.data);
  }
  return { items, unreadable: answer.items.length - items.length };
}

export const jobs: JobsService = {
  list,
  create: (input) => request("/api/jobs", JobSchema, { method: "POST", body: input, area: "Job" }),
  update: (id, patch) => request(path(id), JobSchema, { method: "PATCH", body: patch, area: "Job" }),
  remove: (id) => request(path(id), JobDeletedSchema, { method: "DELETE", area: "Job" }),
  run: (id, override) =>
    request(`${path(id)}/run`, JobSchema, {
      method: "POST",
      area: "Job",
      ...(override !== undefined && { body: override }),
    }),
};
