import { AppError, ERRORS } from "../constants/errors.js";
import type { CatalogJob } from "../store/job-repository.js";

const TOKEN_URL = "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";

export interface CatalogJobDispatcher {
  run(job: CatalogJob): Promise<void>;
}

interface Options {
  project: string;
  region: string;
  fillJob: string;
  updateJob: string;
  fetch?: typeof fetch;
}

const unavailable = (details?: Record<string, unknown>): AppError =>
  new AppError(ERRORS.jobDispatchUnavailable, details);

function accessToken(value: unknown): string {
  if (typeof value !== "object" || value === null || !("access_token" in value)
    || typeof value.access_token !== "string" || value.access_token === "") throw unavailable();
  return value.access_token;
}

function hasActiveExecution(value: unknown): boolean {
  if (typeof value !== "object" || value === null || !("executions" in value) || !Array.isArray(value.executions)) return false;
  return value.executions.some((execution) => typeof execution === "object" && execution !== null
    && !("completionTime" in execution));
}

/** Starts the bounded Cloud Run worker; the worker remains the one place that executes and persists a catalog job. */
export function createCatalogJobDispatcher(options: Options): CatalogJobDispatcher | undefined {
  if ([options.project, options.region, options.fillJob, options.updateJob].some((value) => value === "")) return undefined;
  const request = options.fetch ?? fetch;

  async function token(): Promise<string> {
    try {
      const response = await request(TOKEN_URL, { headers: { "metadata-flavor": "Google" } });
      if (!response.ok) throw unavailable({ status: response.status });
      return accessToken(await response.json());
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw unavailable();
    }
  }

  return {
    async run(job): Promise<void> {
      const worker = job.config.scope === "recent" ? options.updateJob : options.fillJob;
      const root = `https://run.googleapis.com/v2/projects/${encodeURIComponent(options.project)}`
        + `/locations/${encodeURIComponent(options.region)}/jobs/`;
      let response: Response;
      try {
        const bearer = `Bearer ${await token()}`;
        for (const name of new Set([options.fillJob, options.updateJob])) {
          const listed = await request(`${root}${encodeURIComponent(name)}/executions?pageSize=10`,
            { headers: { authorization: bearer } });
          if (!listed.ok) throw unavailable({ status: listed.status });
          if (hasActiveExecution(await listed.json())) throw new AppError(ERRORS.syncBusy);
        }
        response = await request(`${root}${encodeURIComponent(worker)}:run`, {
          method: "POST",
          headers: { authorization: bearer, "content-type": "application/json" },
          body: JSON.stringify({ overrides: { containerOverrides: [{
            env: [{ name: "SYNC_JOB_ID", value: String(job.id) }],
          }] } }),
        });
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw unavailable();
      }
      if (!response.ok) throw unavailable({ status: response.status });
    },
  };
}
