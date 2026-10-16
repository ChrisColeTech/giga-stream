import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";

import { config } from "./config.js";
import { registerErrorHandling } from "./lib/error-handler.js";
import { registerChannelsRoutes } from "./routes/channels.js";
import { registerCollectionsRoutes } from "./routes/collections.js";
import { registerFavoritesRoutes } from "./routes/favorites.js";
import { registerFoldersRoutes } from "./routes/folders.js";
import { registerFsDialogRoutes } from "./routes/fs-dialog.js";
import { registerHealth } from "./routes/health.js";
import { registerImagesRoutes } from "./routes/images.js";
import { registerJobsRoutes } from "./routes/jobs.js";
import { registerLibraryRoutes } from "./routes/library.js";
import { registerLocalMediaRoutes } from "./routes/local-media.js";
import { registerPocResults } from "./routes/poc-results.js";
import { registerSettingsRoutes } from "./routes/settings.js";
import { registerShellStateRoutes } from "./routes/shell-state.js";
import { registerStateRoute } from "./routes/state.js";
import { registerTitlesRoutes } from "./routes/titles.js";
import { registerWatchRoutes } from "./routes/watch.js";
import { createAppServices, type ServiceOptions } from "./services/app-services.js";
import { createPocResultsService } from "./services/poc-results-service.js";

/** The parts of the served folder a browser may load; the PoC's scripts and results are not among them. */
const SERVED_TOP = new Set(["html", "css", "js", "data"]);

function isServed(pathName: string): boolean {
  const parts = pathName.split("/").filter(Boolean);
  if (parts.length === 0) return true;
  if (parts.length === 1) return parts[0] === "index.html";
  return SERVED_TOP.has(parts[0] ?? "");
}

export interface BuildOptions extends Partial<ServiceOptions> {
  webDist?: string;
  logger?: boolean;
}

/**
 * The one Fastify instance (docs/01 section 4.1): static files from `WEB_DIST`, the routes, the one
 * database and its services. `overrides` replace config values without touching `process.env`,
 * which is how tests pass a temporary `DATA_DIR`, the clocks and the fetch seams.
 */
export async function buildApp(overrides: BuildOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: overrides.logger ?? false,
    bodyLimit: 8 * 1024 * 1024,
  });

  const services = createAppServices({
    dataDir: overrides.dataDir ?? config.dataDir,
    allowInsecureAdmin: overrides.allowInsecureAdmin ?? config.allowInsecureAdmin,
    liveViewTtlMs: overrides.liveViewTtlMs ?? config.liveViewTtlMs,
    now: overrides.now ?? Date.now,
    ...(overrides.adminFetch !== undefined && { adminFetch: overrides.adminFetch }),
    ...(overrides.probeFetch !== undefined && { probeFetch: overrides.probeFetch }),
    ...(overrides.imageFetch !== undefined && { imageFetch: overrides.imageFetch }),
    ...(overrides.openFolderPicker !== undefined && { openFolderPicker: overrides.openFolderPicker }),
    testFolderRoot: overrides.testFolderRoot ?? config.testFolderRoot,
  });

  app.addHook("onClose", async () => {
    await services.close();
  });

  await app.register(fastifyStatic, {
    root: overrides.webDist ?? config.webDist,
    index: ["index.html"],
    cacheControl: false,
    allowedPath: (pathName) => isServed(pathName),
  });

  registerErrorHandling(app);
  registerHealth(app, services);
  registerSettingsRoutes(app, services);
  registerShellStateRoutes(app, services);
  registerChannelsRoutes(app, services);
  registerStateRoute(app, services);
  registerPocResults(app, createPocResultsService(config.pocResultsDir));
  registerCollectionsRoutes(app, services);
  registerFoldersRoutes(app, services);
  registerFsDialogRoutes(app, services);
  registerJobsRoutes(app, services);
  registerLocalMediaRoutes(app, services);
  registerImagesRoutes(app, services);
  registerFavoritesRoutes(app, services);
  registerWatchRoutes(app, services);
  registerLibraryRoutes(app, services);
  registerTitlesRoutes(app, services);

  return app;
}
