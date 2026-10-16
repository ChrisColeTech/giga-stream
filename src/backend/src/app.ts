import path from "node:path";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import Fastify, { type FastifyInstance } from "fastify";

import { registerAccounts } from "./api/accounts.js";
import { registerAudit } from "./api/audit.js";
import { registerAuth } from "./api/auth.js";
import { registerChannels } from "./api/channels.js";
import { registerErrorHandling } from "./api/envelope.js";
import { registerHealth } from "./api/health.js";
import { registerPlaylistSync } from "./api/playlist-sync.js";
import { registerProviders } from "./api/providers.js";
import { registerSocket } from "./api/socket.js";
import { registerTitles } from "./api/titles.js";
import { config, type Config } from "./config.js";
import { DATABASE_FILE_NAME } from "./constants/deployment.js";
import { REQUEST_BODY_LIMIT_BYTES, SOCKET_MAX_PAYLOAD_BYTES } from "./constants/limits.js";
import { corsOrigins, isPrivateRoute, startRefusal, tlsOptions } from "./network-policy.js";
import { bootstrapOwner } from "./services/bootstrap-owner.js";
import { createServices } from "./services/service-registry.js";
import { parseSchedule } from "./services/title-service.js";
import { SEED_NEEDS_LOOPBACK, seedTestChannels } from "./services/test-channels.js";
import { createStore } from "./store/store.js";

/**
 * The admin backend's composition root: one Fastify instance per process (`01` section 4.1), one store,
 * one hub. `overrides` replace config values without touching `process.env`, which is how tests pass a
 * temporary `DATA_DIR`, a secret and the flags; `now` is the one clock, `fetchImpl` the one fetch (the
 * test seam for the playlist sync's playlists and logo index). Every route begins `/api`; `/healthz`
 * and `/ws` are the only root exceptions.
 */
export async function buildApp(
  overrides: Partial<Config> = {},
  now: () => number = Date.now,
  fetchImpl: typeof fetch = fetch,
): Promise<FastifyInstance> {
  const settings: Config = { ...config, ...overrides };
  // Refused before any database file is created (docs/03 sections 7.7, 7.10, 7.12).
  const refusal = startRefusal(settings);
  if (refusal) throw new Error(refusal);
  if (settings.SEED_TEST_CHANNELS && !settings.ALLOW_LOOPBACK_STREAMS) throw new Error(SEED_NEEDS_LOOPBACK);
  const https = tlsOptions(settings);

  const store = createStore(path.join(settings.DATA_DIR, DATABASE_FILE_NAME));
  try {
    const services = createServices(store, {
      jwtSecret: settings.JWT_SECRET,
      allowLoopback: settings.ALLOW_LOOPBACK_STREAMS,
      tmdbToken: settings.TMDB_READ_TOKEN,
      tmdbBase: settings.TMDB_BASE,
      omdbKey: settings.OMDB_API_KEY,
      omdbBase: settings.OMDB_BASE,
      omdbDailyLimit: settings.OMDB_DAILY_LIMIT,
      now,
      dataDir: settings.DATA_DIR,
      playlistUrls: settings.PLAYLIST_URLS,
      playlistSyncMaxBytes: settings.PLAYLIST_SYNC_MAX_BYTES,
      playlistSyncMax: settings.PLAYLIST_SYNC_MAX,
      logoIndexTtlHours: settings.LOGO_INDEX_TTL_HOURS,
      fetchImpl,
    });
    const owner = await bootstrapOwner(
      services.accounts,
      services.hasAccounts(),
      settings.ADMIN_BOOTSTRAP_EMAIL,
      settings.ADMIN_BOOTSTRAP_PASSWORD,
    );
    if (settings.SEED_TEST_CHANNELS) seedTestChannels(services.channels);
    services.purgeExpiredSessions();

    // The catalog-sync schedule (docs/03 section 7.6b): one of the system's two timers (docs/01 section 4.4).
    const scheduleMs = parseSchedule(settings.TMDB_SYNC_SCHEDULE);
    if (scheduleMs !== undefined && settings.TMDB_READ_TOKEN !== "") {
      services.titles.armSchedule(scheduleMs);
    }

    // The playlist-sync schedule (docs/03 section 7.2c): armed only when playlists and an interval
    // are both set; with no playlists the sync has nothing to do and stays unarmed.
    const playlistScheduleMs = parseSchedule(settings.PLAYLIST_SYNC_SCHEDULE, "PLAYLIST_SYNC_SCHEDULE");
    if (playlistScheduleMs !== undefined && settings.PLAYLIST_URLS.length > 0) {
      services.playlistSchedule.armSchedule(playlistScheduleMs);
    }

    const app = Fastify({
      logger: settings.NODE_ENV !== "test",
      bodyLimit: REQUEST_BODY_LIMIT_BYTES,
      trustProxy: settings.TRUST_PROXY,
      ...(https && { https }),
    });
    if (owner === "none") {
      app.log.warn("there are no admin accounts and no ADMIN_BOOTSTRAP_EMAIL/PASSWORD: nobody can sign in");
    }
    app.addHook("onClose", async () => {
      services.titles.clearSchedule();
      services.playlistSchedule.clearSchedule();
      services.hub.closeAll();
      store.close();
    });
    app.addHook("onSend", async (request, reply) => {
      if (isPrivateRoute(request.url)) reply.header("cache-control", "no-store");
    });
    registerErrorHandling(app);
    const origins = corsOrigins(settings);
    await app.register(cors, { origin: origins.length > 0 ? origins : false, methods: ["GET", "POST", "PATCH", "DELETE"] });
    await app.register(websocket, { options: { maxPayload: SOCKET_MAX_PAYLOAD_BYTES } });
    registerHealth(app, services);
    registerAuth(app, services);
    registerAccounts(app, services);
    registerAudit(app, services);
    registerChannels(app, services);
    registerProviders(app, services);
    registerTitles(app, services);
    registerPlaylistSync(app, services);
    registerSocket(app, services);
    return app;
  } catch (error) {
    store.close();
    throw error;
  }
}
