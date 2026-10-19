import { existsSync } from "node:fs";
import path from "node:path";

import httpProxy from "@fastify/http-proxy";
import type { FastifyReplyFromHooks } from "@fastify/reply-from";
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
const SERVED_TOP = new Set(["html", "css", "js", "data", "assets"]);
const SERVED_FILES = new Set(["index.html", "favicon.ico", "favicon.svg"]);

function isServed(pathName: string): boolean {
  const parts = pathName.split("/").filter(Boolean);
  if (parts.length === 0) return true;
  if (parts.length === 1) return SERVED_FILES.has(parts[0] ?? "");
  return SERVED_TOP.has(parts[0] ?? "");
}

export interface BuildOptions extends Partial<ServiceOptions> {
  webDist?: string;
  logger?: boolean;
  /** Check the backend cache at launch, detached (docs/46 section C). Defaults to true; tests turn it off. */
  syncOnStart?: boolean;
  /** The admin backend the reverse proxy points at; empty (the config default) leaves the proxy off. */
  adminProxyTarget?: string;
}

/**
 * The header list a proxied request carries on to the backend: the forwarded-for chain it arrived
 * with, then this fileserver's direct peer (`request.ip`). Render's public entry is this proxy, so
 * the chain is what lets the backend's `TRUST_PROXY` rate limiting see the real client.
 */
const withForwardedFor: NonNullable<FastifyReplyFromHooks["rewriteRequestHeaders"]> = (request, headers) => {
  const seen = headers["x-forwarded-for"];
  const chain = seen === undefined ? [] : Array.isArray(seen) ? seen : [seen];
  return { ...headers, "x-forwarded-for": [...chain, request.ip].join(", ") };
};

/**
 * The reverse proxy to the admin backend sibling (docs/03 section 1's Render shape, one public port): the
 * backend's admin API passes through identity (`/api/admin/...` → the backend's `/api/admin/...`, every other
 * `/api` address stays here), the console UI arrives with its prefix stripped (`/admin/...` → the backend's
 * root), and the live stream addresses keep their paths. REST only (docs/01 section 4.4): the WebSocket
 * default stays off. Registered before the static plugin; the prefixes touch no other `/api`, `/healthz` or
 * SPA address of this fileserver.
 */
async function registerAdminProxy(app: FastifyInstance, target: string): Promise<void> {
  const replyOptions = { rewriteRequestHeaders: withForwardedFor };
  await app.register(httpProxy, { upstream: target, prefix: "/api/admin", rewritePrefix: "/api/admin", replyOptions });
  await app.register(httpProxy, { upstream: target, prefix: "/admin", rewritePrefix: "", replyOptions });
  await app.register(httpProxy, { upstream: target, prefix: "/live", rewritePrefix: "/live", replyOptions });
  await app.register(httpProxy, { upstream: target, prefix: "/logos", rewritePrefix: "/logos", replyOptions });
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

  const webDist = path.resolve(overrides.webDist ?? config.webDist);
  const adminProxyTarget = overrides.adminProxyTarget ?? config.adminProxyTarget;
  const services = createAppServices({
    dataDir: overrides.dataDir ?? config.dataDir,
    allowInsecureAdmin: overrides.allowInsecureAdmin ?? config.allowInsecureAdmin,
    defaultAdminUrl: overrides.defaultAdminUrl ?? config.defaultAdminUrl,
    now: overrides.now ?? Date.now,
    ...(overrides.adminFetch !== undefined && { adminFetch: overrides.adminFetch }),
    ...(overrides.imageFetch !== undefined && { imageFetch: overrides.imageFetch }),
    ...(overrides.scan !== undefined && { scan: overrides.scan }),
    ...(overrides.openFolderPicker !== undefined && { openFolderPicker: overrides.openFolderPicker }),
    testFolderRoot: overrides.testFolderRoot ?? config.testFolderRoot,
  });

  app.addHook("onClose", async () => {
    await services.close();
  });
  if (overrides.syncOnStart ?? true) services.cache.start();

  if (adminProxyTarget !== "") await registerAdminProxy(app, adminProxyTarget);

  // The SPA entry (22 section 5.2): a GET that is no route, no /api address and no served file
  // answers index.html when the dist has one; everything else stays the JSON 404 envelope.
  // `wildcard: false` registers a route per dist file instead of a catch-all, so a static miss is
  // an ordinary no-route request — the one not-found handler owns it, never a plugin 404.
  const spaEntry = path.join(webDist, "index.html");
  registerErrorHandling(
    app,
    existsSync(spaEntry) ? (pathName: string) => (isServed(pathName) ? undefined : spaEntry) : undefined,
  );

  await app.register(fastifyStatic, {
    root: webDist,
    wildcard: false,
    index: ["index.html"],
    cacheControl: false,
    allowedPath: (pathName) => isServed(pathName),
  });
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
