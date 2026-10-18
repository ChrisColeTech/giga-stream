import { APP_ROLE, APP_VERSION } from "../constants/deployment.js";
import { SYNC_CONCURRENCY, SYNC_PER_HOST_CONCURRENCY } from "../constants/limits.js";
import { createLiveEngine, type LiveSeams } from "../live/engine/live-engine.js";
import type { Store } from "../store/store.js";
import { createAccountService } from "./account-service.js";
import { createAdminStatic } from "./admin-static-service.js";
import { createAuditService } from "./audit-service.js";
import { createAuthService } from "./auth-service.js";
import { createChannelService } from "./channel-service.js";
import { createJobEvents } from "./job-events.js";
import { createJobProgress } from "./job-progress.js";
import { createJobRunner } from "./job-runner.js";
import { createJobService } from "./job-service.js";
import { createLogoCache } from "./logo-cache.js";
import { createLogoFill } from "./logo-fill.js";
import { createLogoResolver } from "./logo-resolver.js";
import { createOmdbClient } from "./omdb-client.js";
import { createRequestLimiter } from "./request-limiter.js";
import { createStreamCheck } from "./stream-check.js";
import { createPlaylistImporter } from "./playlist-import.js";
import { createPlaylistJob } from "./playlist-job.js";
import { createPlaylistService } from "./playlist-service.js";
import { createProviderService } from "./provider-service.js";
import { createSafeFetch, type SafeFetch } from "./safe-fetch.js";
import { createSecurityQuestionService } from "./security-question-service.js";
import { createStreamTemplates } from "./stream-templates.js";
import { createSyncScheduler } from "./sync-scheduler.js";
import { seedSyncRecords } from "./sync-seed.js";
import { createTitleService } from "./title-service.js";
import { createStoredTitles } from "./title-stored-service.js";
import { createTmdbClient } from "./tmdb-client.js";
import { createUiStateService } from "./ui-state-service.js";

export interface ServiceOptions {
  jwtSecret: string;
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
  /** The environment's catalog-sync interval: it seeds the catalog job on the first start only (docs/26 section 3.11). */
  titleSchedule: string;
  playlistSyncMaxBytes: number;
  playlistSyncMax: number;
  /** The guarded outbound fetch for every address that comes from playlist content (docs/43 section 3.8). */
  safeFetch?: SafeFetch;
  /** How long the iptv-org logo index is kept before it is fetched again (hours). */
  logoIndexTtlHours?: number;
}

/** Every service, built once from the store; routes receive this and call one service each. */
export function createServices(store: Store, options: ServiceOptions) {
  const { now } = options;
  const audit = createAuditService(store, now);
  const auth = createAuthService({ store, audit, secret: options.jwtSecret, now });
  const securityQuestions = createSecurityQuestionService({
    store, audit, revokeAll: auth.revokeAll, secret: options.jwtSecret, now,
  });
  const tmdb = createTmdbClient({ token: options.tmdbToken, base: options.tmdbBase, now });
  const omdb = createOmdbClient({ key: options.omdbKey, base: options.omdbBase, dailyLimit: options.omdbDailyLimit, now });
  const streams = createStreamTemplates({
    movieTemplate: options.movieStreamTemplate,
    episodeTemplate: options.episodeStreamTemplate,
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

  // The first start seeds the catalog job from the environment; after that it is the truth. Playlists come from imports.
  seedSyncRecords(store, { titleSchedule: options.titleSchedule }, now());
  /** The schedule a sync status shows: the first enabled job of the type that has one. */
  const scheduleOf = (type: "playlist" | "catalog"): string =>
    store.jobs.list().find((j) => j.type === type && j.enabled && j.schedule !== "off")?.schedule ?? "off";
  const titles = createTitleService({
    store, audit, tmdb, omdb, streams, now,
    scheduleLabel: () => scheduleOf("catalog"),
  });
  const safeFetch = options.safeFetch ?? createSafeFetch();
  const importer = createPlaylistImporter({
    store, audit, now, safeFetch,
    maxBytes: options.playlistSyncMaxBytes,
    maxEntries: options.playlistSyncMax,
    onChange: () => scheduler.arm(),
  });
  const limiter = createRequestLimiter({ global: SYNC_CONCURRENCY, perHost: SYNC_PER_HOST_CONCURRENCY });
  const logoCache = createLogoCache({ store, safeFetch, limiter, dataDir: options.dataDir, now });
  const resolver = createLogoResolver({ dataDir: options.dataDir, ttlHours: options.logoIndexTtlHours ?? 24, safeFetch, now });
  const progress = createJobProgress({ now });
  const events = createJobEvents({ progress });
  const runner = createJobRunner({
    store, audit, now, titles, progress,
    playlistJob: createPlaylistJob({
      store, importer, now, logoCache,
      fillLogos: createLogoFill({ store, resolver }),
      checkStreams: createStreamCheck({ store, safeFetch, limiter, now }),
    }),
    onSettled: () => scheduler.arm(),
  });
  const scheduler = createSyncScheduler({ store, runner, now, tmdbConfigured: options.tmdbToken !== "" });
  return {
    runner,
    events,
    importer,
    logoCache,
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
    channels: createChannelService({ store, audit, live, now }),
    providers: createProviderService({ store, audit, now }),
    titles,
    storedTitles: createStoredTitles(store),
    playlists: createPlaylistService({ store, audit, runner, onChange: scheduler.arm }),
    jobs: createJobService({ store, audit, now, runner, progress, onChange: scheduler.arm }),
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
