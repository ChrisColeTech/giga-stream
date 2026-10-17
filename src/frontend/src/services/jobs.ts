import type { z } from "zod";
import { api } from "./api";
import { JobListSchema, JobSchema } from "./schemas/job-schema";
import { RemovedSchema } from "./schemas/collection-schema";

const part = (value: string): string => encodeURIComponent(value);

export function listJobs(signal?: AbortSignal): Promise<z.infer<typeof JobListSchema>> {
  return api("/api/jobs", JobListSchema, { signal, area: "Scan" });
}

export function cancelJob(jobId: string): Promise<z.infer<typeof JobSchema>> {
  return api(`/api/jobs/${part(jobId)}/cancel`, JobSchema, { method: "POST", area: "Scan" });
}

export function dismissJob(jobId: string): Promise<z.infer<typeof RemovedSchema>> {
  return api(`/api/jobs/${part(jobId)}`, RemovedSchema, { method: "DELETE", area: "Scan" });
}
