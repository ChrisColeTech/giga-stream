import { APP_ROLE, APP_VERSION } from "../constants/deployment.js";
import { Hub } from "../events/hub.js";
import type { Store } from "../store/store.js";
import type { PlaylistSyncStatus } from "../types/playlist-sync.js";
import { createAccountService } from "./account-service.js";
import { createAuditService } from "./audit-service.js";
import { createAuthService } from "./auth-service.js";
import { createChannelService } from "./channel-service.js";
import { createLogoResolver } from "./logo-resolver.js";
import { createOmdbClient } from "./omdb-client.js";
import { createPlaylistSchedule } from "./playlist-schedule.js";
import { createPlaylistSyncService } from "./playlist-sync-service.js";
import { createProviderService } from "./provider-service.js";
import { createSignInLimiter } from "./sign-in-limiter.js";
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
  now: () => number;
  dataDir: string;
  playlistUrls: string[];
  playlistSyncMaxBytes: number;
  playlistSyncMax: number;
  logoIndexTtlHours: number;
  fetchImpl?: typeof fetch;
}

/** Every service, built once from the store; routes receive this and call one service each. */
export function createServices(store: Store, options: ServiceOptions) {
  const { now } = options;
  const hub = new Hub(() => store.revisions.current(), now);
  const audit = createAuditService(store, now);
  const auth = createAuthService({ store, audit, limiter: createSignInLimiter(now), secret: options.jwtSecret, now });
  const tmdb = createTmdbClient({ token: options.tmdbToken, base: options.tmdbBase, now });
  const omdb = createOmdbClient({ key: options.omdbKey, base: options.omdbBase, dailyLimit: options.omdbDailyLimit, now });
  const logos = createLogoResolver({ dataDir: options.dataDir, ttlHours: options.logoIndexTtlHours, fetchImpl: options.fetchImpl, now });
  const playlistSyncService = createPlaylistSyncService({
    store,
    events: hub,
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
  return {
    hub,
    audit,
    auth,
    tmdb,
    omdb,
    accounts: createAccountService({ store, audit, revokeAll: auth.revokeAll, now }),
    channels: createChannelService({ store, events: hub, audit, allowLoopback: options.allowLoopback, now }),
    providers: createProviderService({ store, events: hub, audit, now }),
    titles: createTitleService({ store, events: hub, audit, tmdb, omdb, now }),
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
    }),
  };
}

export type Services = ReturnType<typeof createServices>;
