import path from "node:path";
import type { Config } from "../config.js";
import { DATABASE_FILE_NAME } from "../constants/deployment.js";
import { createStore } from "../store/store.js";
import type { CatalogWorkerRuntime } from "../types/catalog-worker.js";
import { createCatalogServices } from "./catalog-services.js";
import { createJobProgress } from "./job-progress.js";
import { createJobRunner } from "./job-runner.js";
import { serviceOptions } from "./service-options.js";

/** No HTTP, accounts bootstrap, seeds, live engine, event stream or scheduler is constructed by this entrypoint. */
export async function openCatalogWorker(settings: Config): Promise<CatalogWorkerRuntime> {
  const store = await createStore(path.join(settings.DATA_DIR, DATABASE_FILE_NAME));
  try {
    const now = Date.now;
    const options = serviceOptions(settings, now, () => undefined);
    // This process is the executor even when the image's API defaults to external execution.
    const { titles, audit } = createCatalogServices(store, options, async () => "off");
    const progress = createJobProgress({ now });
    const runner = createJobRunner({
      store, titles, audit, progress, now,
      playlistJob: async () => { throw new Error("The catalog worker cannot run playlists."); },
      onSettled: () => undefined,
    });
    return {
      jobs: store.jobs, runner, progress,
      close: () => { titles.close(); store.close(); },
    };
  } catch (error) {
    store.close();
    throw error;
  }
}
