import path from "node:path";
import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";

import { registerAccountState } from "./api/account-state.js";
import { registerAccounts } from "./api/accounts.js";
import { registerAdminChannels } from "./api/admin-channels.js";
import { registerAdminStatic } from "./api/admin-static.js";
import { registerAudit } from "./api/audit.js";
import { registerAuth } from "./api/auth.js";
import { registerAuthSecurity } from "./api/auth-security.js";
import { registerChannels } from "./api/channels.js";
import { registerErrorHandling } from "./api/envelope.js";
import { registerHealth } from "./api/health.js";
import { registerLiveFaults } from "./api/live-faults.js";
import { registerLiveStreams } from "./api/live-streams.js";
import { registerJobs } from "./api/jobs.js";
import { registerPlaylists } from "./api/playlists.js";
import { registerProviders } from "./api/providers.js";
import { registerTitles } from "./api/titles.js";
import { bootstrapUsername } from "./bootstrap-username.js";
import { config, type Config } from "./config.js";
import { DATABASE_FILE_NAME } from "./constants/deployment.js";
import { REQUEST_BODY_LIMIT_BYTES } from "./constants/limits.js";
import type { LiveSeams } from "./live/engine/live-engine.js";
import { corsOrigins, isPrivateRoute, startRefusal, tlsOptions } from "./network-policy.js";
import { bootstrapAdmin } from "./services/bootstrap-admin.js";
import { createSafeFetch, type SafeFetch } from "./services/safe-fetch.js";
import { createServices, type Services } from "./services/service-registry.js";
import { seedTestChannels } from "./services/test-channels.js";
import { createStore } from "./store/store.js";

/**
 * The admin backend's composition root: one Fastify instance per process (`01` section 4.1), one store, one
 * live engine, and no socket: readers learn of changes from the revision in each answer (`01` section 4.4).
 * `overrides` replace config values without touching `process.env`, which is how tests pass a temporary
 * `DATA_DIR`, a secret and the flags; `now` is the one clock, `live` the engine's seams (a fake build, a fake sleep)
 * and `safeFetchImpl` the one guarded outbound fetch for every address that comes from playlist content (the test
 * seam for the playlists; `docs/43` section 3.8). Fixed provider hosts (TMDB, OMDb) use `fetch` directly and are
 * stubbed through their base addresses. Every route begins `/api`; the exceptions are `/healthz`, the live stream
 * addresses (`/live`, `/logos`, the test page) and the admin app at `/admin/` (`01` section 4.3).
 */
export async function buildApp(
  overrides: Partial<Config> = {},
  now: () => number = Date.now,
  safeFetchImpl: SafeFetch = createSafeFetch(),
  live: LiveSeams = {},
): Promise<FastifyInstance> {
  const settings: Config = { ...config, ...overrides };
  // Refused before any database file is created (docs/03 sections 7.10 and 7.12).
  const refusal = startRefusal(settings);
  if (refusal) throw new Error(refusal);
  const https = tlsOptions(settings);

  const store = createStore(path.join(settings.DATA_DIR, DATABASE_FILE_NAME));
  let services: Services | undefined;
  try {
    const app = Fastify({
      logger: settings.NODE_ENV !== "test",
      bodyLimit: REQUEST_BODY_LIMIT_BYTES,
      trustProxy: settings.TRUST_PROXY,
      ...(https && { https }),
    });
    services = createServices(store, {
      jwtSecret: settings.JWT_SECRET,
      tmdbToken: settings.TMDB_READ_TOKEN,
      tmdbBase: settings.TMDB_BASE,
      omdbKey: settings.OMDB_API_KEY,
      omdbBase: settings.OMDB_BASE,
      omdbDailyLimit: settings.OMDB_DAILY_LIMIT,
      movieStreamTemplate: settings.MOVIE_STREAM_TEMPLATE,
      episodeStreamTemplate: settings.EPISODE_STREAM_TEMPLATE,
      now,
      dataDir: settings.DATA_DIR,
      cacheDir: settings.CACHE_DIR || path.join(settings.DATA_DIR, "cache"),
      adminDist: settings.ADMIN_DIST,
      log: (line) => app.log.warn(line),
      live,
      titleSchedule: settings.TMDB_SYNC_SCHEDULE,
      playlistSyncMaxBytes: settings.PLAYLIST_SYNC_MAX_BYTES,
      playlistSyncMax: settings.PLAYLIST_SYNC_MAX,
      safeFetch: safeFetchImpl,
    });
    const ready = services;
    const bootstrap = await bootstrapAdmin(
      ready.accounts,
      ready.hasAccounts(),
      bootstrapUsername(settings),
      settings.ADMIN_BOOTSTRAP_PASSWORD,
    );
    // Every saved live channel builds in the background, so the server answers at once. The seed (an empty
    // store only) starts its own channels as it creates them.
    ready.channels.startLive();
    if (settings.SEED_TEST_CHANNELS) {
      const seeded = seedTestChannels(ready.channels, settings.FIXTURE_DIR);
      if (seeded.repaired > 0) app.log.info(`seed: repaired ${seeded.repaired} legacy stream channel(s) into live channels`);
    }
    ready.purgeExpiredSessions();

    // The one timer (docs/01 section 4.4) is armed for the earliest due enabled job (docs/26 section 3.11).
    ready.scheduler.arm();

    if (bootstrap === "none") {
      app.log.warn("there are no admin accounts and no ADMIN_BOOTSTRAP_USERNAME/PASSWORD: nobody can sign in");
    }
    app.addHook("onClose", async () => {
      ready.scheduler.stop();
      ready.titles.close();
      // Every playlist run is aborted and has settled before the store closes.
      await ready.runner.shutdown();
      // Every ffmpeg tree is killed and every encode-mode output removed before the store closes.
      await ready.live.stop();
      store.close();
    });
    app.addHook("onSend", async (request, reply) => {
      if (isPrivateRoute(request.url, request.method, request.headers.authorization !== undefined)) reply.header("cache-control", "no-store");
    });
    registerErrorHandling(app);
    // The streams first: they carry their own CORS policy as encapsulated plugins, and a child plugin only
    // inherits what its parent has when it is created (the root CORS below also decorates the request).
    await registerLiveStreams(app, ready, settings);
    const origins = corsOrigins(settings);
    await app.register(cors, {
      origin: origins.length > 0 ? origins : false,
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    });
    registerHealth(app, ready);
    registerAuth(app, ready);
    registerAuthSecurity(app, ready);
    registerAccountState(app, ready);
    registerAccounts(app, ready);
    registerAudit(app, ready);
    registerChannels(app, ready);
    registerAdminChannels(app, ready);
    registerLiveFaults(app, ready);
    registerProviders(app, ready);
    registerTitles(app, ready);
    registerPlaylists(app, ready);
    registerJobs(app, ready);
    registerAdminStatic(app, ready);
    return app;
  } catch (error) {
    await services?.live.stop();
    store.close();
    throw error;
  }
}
