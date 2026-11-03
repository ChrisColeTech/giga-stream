import type { JobRunner } from "../services/job-runner.js";
import type { JobProgressRegistry } from "../services/job-progress.js";
import type { Store } from "../store/store.js";

export interface CatalogWorkerRuntime {
  jobs: Pick<Store["jobs"], "find">;
  runner: Pick<JobRunner, "run" | "wait" | "abort" | "shutdown">;
  progress: Pick<JobProgressRegistry, "subscribe">;
  close: () => void | Promise<void>;
}

export type WorkerLog = (event: Record<string, string | number>) => void;
