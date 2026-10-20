import path from "node:path";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { existsSync } from "node:fs";
import Fastify, { type FastifyInstance } from "fastify";

import { registerAccountState } from "./api/account-state.js";
import { registerAccountAuth } from "./api/account-auth.js";
import { registerAccountCollections } from "./api/account-collections.js";
import { registerAccountData } from "./api/account-data.js";
import { registerAccounts } from "./api/accounts.js";
import { registerAdminChannels } from "./api/admin-channels.js";
import { registerAdminStatic } from "./api/admin-static.js";
import { registerAdminTitles } from "./api/admin-titles.js";
import { registerAdminTmdb } from "./api/admin-tmdb.js";
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
 * stubbed through their base addresses. Every route begins `/api` — the public reads of `/api/channels*` and
 * `/api/titles/...` on the root, the console's whole API in the one `/api/admin` plugin — and the exceptions are
 * `/healthz`, the live stream addresses (`/live`, `/logos`, the test page) and the admin app at `/admin/`
 * (`01` section 4.3).
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

  const store = await createStore(path.join(settings.DATA_DIR, DATABASE_FILE_NAME));
  let services: Services | undefined;
  try {
    const app = Fastify({
      logger: settings.NODE_ENV !== "test",
      bodyLimit: REQUEST_BODY_LIMIT_BYTES,
      trustProxy: settings.TRUST_PROXY,
      ...(https && { https }),
    });
    services = await createServices(store, {
      jwtSecret: settings.JWT_SECRET,
      tmdbToken: settings.TMDB_READ_TOKEN,
      tmdbBase: settings.TMDB_BASE,
      tmdbMinGapMs: settings.TMDB_MIN_GAP_MS,
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
      logoIndexTtlHours: settings.LOGO_INDEX_TTL_HOURS,
    });
    const ready = services;
    const bootstrap = await bootstrapAdmin(
      ready.accounts,
      await ready.hasAccounts(),
      bootstrapUsername(settings),
      settings.ADMIN_BOOTSTRAP_PASSWORD,
    );
    // Every saved live channel builds in the background, so the server answers at once. The seed (an empty
    // store only) starts its own channels as it creates them.
    await ready.channels.startLive();
    if (settings.SEED_TEST_CHANNELS) {
      const seeded = await seedTestChannels(ready.channels, settings.FIXTURE_DIR);
      if (seeded.repaired > 0) app.log.info(`seed: repaired ${seeded.repaired} legacy stream channel(s) into live channels`);
    }
    await ready.purgeExpiredSessions();

    // The one timer (docs/01 section 4.4) is armed for the earliest due enabled job (docs/26 section 3.11).
    ready.scheduler.arm();

    if (bootstrap === "none") {
      app.log.warn("there are no admin accounts and no ADMIN_BOOTSTRAP_USERNAME/PASSWORD: nobody can sign in");
    }
    // First: an open progress stream must not hold the server open. Fastify 5 waits for the open connections BEFORE it runs
    // the `onClose` hooks (a test showed `app.close()` hanging on an open stream), so the streams are ended in `preClose`;
    // `onClose` ends any that opened since.
    app.addHook("preClose", async () => ready.events.closeAll());
    app.addHook("onClose", async () => {
      ready.events.closeAll();
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
    registerChannels(app, ready);
    registerTitles(app, ready);
    // The admin console's whole API is one encapsulated plugin (the same shape as the `/live` and `/logos`
    // prefixes): every register function in it names its path relative to `/api/admin`, so the admin surface
    // is one namespace no public route shares. The per-route `signedIn` checks stay in each file; sign-in
    // itself has none. Its guard demands kind='admin' (docs/62 D3).
    await app.register(
      async (admin) => {
        registerAccountState(admin, ready);
        registerAccounts(admin, ready);
        registerAdminChannels(admin, ready);
        registerAdminTitles(admin, ready);
        registerAdminTmdb(admin, ready);
        registerAudit(admin, ready);
        registerAuth(admin, ready);
        registerJobs(admin, ready);
        registerLiveFaults(admin, ready);
        registerPlaylists(admin, ready);
        registerProviders(admin, ready);
      },
      { prefix: "/api/admin" },
    );
    // The password reset (docs/40 section 2.4) is public, both kinds, both cookie scopes: root /api/auth.
    await app.register(async (authReset) => registerAuthSecurity(authReset, ready), { prefix: "/api/auth" });
    // The app's own API (docs/62 sections 3.2-3.3): the same plugin shape at its guard, its cookie on its prefix (D4).
    await app.register(
      async (account) => {
        registerAccountAuth(account, ready);
        registerAccountCollections(account, ready);
        registerAccountData(account, ready);
      },
      { prefix: "/api/account" },
    );
    registerAdminStatic(app, ready);
    // The root-level admin UI (docs/26 section 4.1), after every API route so nothing shadows `/api`, `/healthz`,
    // `/live`, `/logos`, `/admin` or the test page. `wildcard: false` answers only real files: `/` finds the
    // `index.html`, anything else falls through to the JSON 404 envelope. With no UI built, nothing is served.
    const publicIndex = path.join(settings.PUBLIC_DIR, "index.html");
    if (existsSync(publicIndex)) {
      await app.register(fastifyStatic, {
        root: settings.PUBLIC_DIR,
        wildcard: false,
        index: ["index.html"],
        cacheControl: false,
      });
    }
    return app;
  } catch (error) {
    await services?.live.stop();
    store.close();
    throw error;
  }
}
