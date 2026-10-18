import { APP_ROLE, APP_VERSION } from "../constants/deployment.js";
import { createLiveEngine, type LiveSeams } from "../live/engine/live-engine.js";
import type { Store } from "../store/store.js";
import type { PlaylistSyncStatus } from "../types/playlist-sync.js";
import { createAccountService } from "./account-service.js";
import { createAdminStatic } from "./admin-static-service.js";
import { createAuditService } from "./audit-service.js";
import { createAuthService } from "./auth-service.js";
import { createChannelService } from "./channel-service.js";
import { createJobRunner } from "./job-runner.js";
import { createJobService } from "./job-service.js";
import { createLogoResolver } from "./logo-resolver.js";
import { createOmdbClient } from "./omdb-client.js";
import { createPlaylistService } from "./playlist-service.js";
import { createPlaylistSyncService } from "./playlist-sync-service.js";
import { createProviderService } from "./provider-service.js";
import { createSecurityQuestionService } from "./security-question-service.js";
import { createSignInLimiter } from "./sign-in-limiter.js";
import { createStreamTemplates } from "./stream-templates.js";
import { createSyncScheduler } from "./sync-scheduler.js";
import { seedSyncRecords } from "./sync-seed.js";
import { createTitleService } from "./title-service.js";
import { createTmdbClient } from "./tmdb-client.js";
import { createUiStateService } from "./ui-state-service.js";

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
  /** The environment's sync values: they seed the playlists and jobs on the first start only (docs/26 section 3.11). */
  titleSchedule: string;
  playlistSchedule: string;
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
  // One per-address limiter for sign-in and the two reset routes (docs/40 section 2.4).
  const limiter = createSignInLimiter(now);
  const auth = createAuthService({ store, audit, limiter, secret: options.jwtSecret, now });
  const securityQuestions = createSecurityQuestionService({
    store, audit, limiter, revokeAll: auth.revokeAll, secret: options.jwtSecret, now,
  });
  const tmdb = createTmdbClient({ token: options.tmdbToken, base: options.tmdbBase, now });
  const omdb = createOmdbClient({ key: options.omdbKey, base: options.omdbBase, dailyLimit: options.omdbDailyLimit, now });
  const logos = createLogoResolver({ dataDir: options.dataDir, ttlHours: options.logoIndexTtlHours, fetchImpl: options.fetchImpl, now });
  const playlistSync = createPlaylistSyncService({
    store,
    audit,
    logos,
    maxBytes: options.playlistSyncMaxBytes,
    maxEntries: options.playlistSyncMax,
    allowLoopback: options.allowLoopback,
    fetchImpl: options.fetchImpl,
    now,
  });
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
    knows: (id) => {
      const record = store.channels.find(id);
      return record?.kind === "live" && record.enabled;
    },
    ...(options.live && { seams: options.live }),
  });
  options.live?.onEngine?.(live);

  // The first start seeds the playlists and the jobs from the environment; after that they are the truth.
  seedSyncRecords(store, { playlistUrls: options.playlistUrls, playlistSchedule: options.playlistSchedule, titleSchedule: options.titleSchedule }, now());
  /** The schedule a sync status shows: the first enabled job of the type that has one. */
  const scheduleOf = (type: "playlist" | "catalog"): string =>
    store.jobs.list().find((j) => j.type === type && j.enabled && j.schedule !== "off")?.schedule ?? "off";
  const titles = createTitleService({
    store, audit, tmdb, omdb, streams, now,
    allowLoopback: options.allowLoopback,
    scheduleLabel: () => scheduleOf("catalog"),
  });
  const runner = createJobRunner({ store, now, playlistSync, titles });
  const scheduler = createSyncScheduler({ store, runner, now, tmdbConfigured: options.tmdbToken !== "" });
  return {
    audit,
    auth,
    securityQuestions,
    tmdb,
    omdb,
    live,
    scheduler,
    adminStatic: createAdminStatic(options.adminDist),
    accounts: createAccountService({ store, audit, revokeAll: auth.revokeAll, now }),
    uiState: createUiStateService({ store, now, log: options.log }),
    channels: createChannelService({ store, audit, live, allowLoopback: options.allowLoopback, now }),
    providers: createProviderService({ store, audit, now }),
    titles,
    playlists: createPlaylistService({ store, audit, now, allowLoopback: options.allowLoopback, onChange: scheduler.arm }),
    jobs: createJobService({ store, audit, now, runner, onChange: scheduler.arm }),
    /** Thin wrappers over the same code: a run covers every enabled playlist; the status is the aggregate. */
    playlistSync: {
      run: playlistSync.run,
      status: (): PlaylistSyncStatus => ({ ...playlistSync.status(), schedule: scheduleOf("playlist") }),
    },
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
