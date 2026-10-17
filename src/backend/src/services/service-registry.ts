import { APP_ROLE, APP_VERSION } from "../constants/deployment.js";
import { createLiveEngine, type LiveSeams } from "../live/engine/live-engine.js";
import type { Store } from "../store/store.js";
import type { PlaylistSyncStatus } from "../types/playlist-sync.js";
import { createAccountService } from "./account-service.js";
import { createAdminStatic } from "./admin-static-service.js";
import { createAuditService } from "./audit-service.js";
import { createAuthService } from "./auth-service.js";
import { createChannelService } from "./channel-service.js";
import { createLogoResolver } from "./logo-resolver.js";
import { createOmdbClient } from "./omdb-client.js";
import { createPlaylistSchedule } from "./playlist-schedule.js";
import { createPlaylistSyncService } from "./playlist-sync-service.js";
import { createProviderService } from "./provider-service.js";
import { createSignInLimiter } from "./sign-in-limiter.js";
import { createStreamTemplates } from "./stream-templates.js";
import { createTitleService } from "./title-service.js";
import { createTmdbClient } from "./tmdb-client.js";

export interface ServiceOptions {
  jwtSecret: string;
  allowLoopback: boolean;
  tmdbToken: string;
  tmdbBase?: string;
  omdbKey: string;
  omdbBase?: string;
  omdbDailyLimit?: number;
  movieStreamTemplate: string;
  episodeStreamTemplate: string;
  now: () => number;
  dataDir: string;
  /** Loop mode's encoded videos (`CACHE_DIR`, default `<dataDir>/cache`); large. */
  cacheDir: string;
  /** The built admin app, served at `/admin/` when it has an `index.html`. */
  adminDist: string;
  /** Where the live engine reports a channel that failed to build. */
  log: (line: string) => void;
  /** Test seams of the live engine: a fake build, a fake sleep. */
  live?: LiveSeams;
  playlistUrls: string[];
  playlistSyncMaxBytes: number;
  playlistSyncMax: number;
  logoIndexTtlHours: number;
  fetchImpl?: typeof fetch;
}

/** Every service, built once from the store; routes receive this and call one service each. */
export function createServices(store: Store, options: ServiceOptions) {
  const { now } = options;
  const audit = createAuditService(store, now);
  const auth = createAuthService({ store, audit, limiter: createSignInLimiter(now), secret: options.jwtSecret, now });
  const tmdb = createTmdbClient({ token: options.tmdbToken, base: options.tmdbBase, now });
  const omdb = createOmdbClient({ key: options.omdbKey, base: options.omdbBase, dailyLimit: options.omdbDailyLimit, now });
  const logos = createLogoResolver({ dataDir: options.dataDir, ttlHours: options.logoIndexTtlHours, fetchImpl: options.fetchImpl, now });
  const playlistSyncService = createPlaylistSyncService({
    store,
    audit,
    logos,
    playlistUrls: options.playlistUrls,
    maxBytes: options.playlistSyncMaxBytes,
    maxEntries: options.playlistSyncMax,
    allowLoopback: options.allowLoopback,
    fetchImpl: options.fetchImpl,
    now,
  });
  const playlistSchedule = createPlaylistSchedule({ sync: playlistSyncService, now });
  const streams = createStreamTemplates({
    movieTemplate: options.movieStreamTemplate,
    episodeTemplate: options.episodeStreamTemplate,
    allowLoopback: options.allowLoopback,
  });
  const live = createLiveEngine({
    cacheDir: options.cacheDir,
    dataDir: options.dataDir,
    now,
    log: options.log,
    knows: (id) => store.channels.find(id)?.kind === "live",
    ...(options.live && { seams: options.live }),
  });
  options.live?.onEngine?.(live);
  return {
    audit,
    auth,
    tmdb,
    omdb,
    live,
    adminStatic: createAdminStatic(options.adminDist),
    accounts: createAccountService({ store, audit, revokeAll: auth.revokeAll, now }),
    channels: createChannelService({ store, audit, live, allowLoopback: options.allowLoopback, now }),
    providers: createProviderService({ store, audit, now }),
    titles: createTitleService({ store, audit, tmdb, omdb, streams, now }),
    playlistSync: {
      run: playlistSyncService.run,
      status: (): PlaylistSyncStatus => ({ ...playlistSyncService.status(), schedule: playlistSchedule.describe() }),
    },
    playlistSchedule,
    hasAccounts: (): boolean => store.accounts.count() > 0,
    purgeExpiredSessions: (): void => store.refreshTokens.purgeExpired(now()),
    health: () => ({
      role: APP_ROLE,
      version: APP_VERSION,
      revision: store.revisions.current(),
      tmdb: options.tmdbToken !== "" ? ("configured" as const) : ("absent" as const),
      liveChannels: store.channels.countLive(),
    }),
  };
}

export type Services = ReturnType<typeof createServices>;
