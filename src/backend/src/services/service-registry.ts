import { APP_ROLE, APP_VERSION } from "../constants/deployment.js";
import { SYNC_CONCURRENCY, SYNC_PER_HOST_CONCURRENCY } from "../constants/limits.js";
import { EXTERNAL_EXECUTION_REASON } from "../constants/sync-execution.js";
import { createLiveEngine, type LiveSeams } from "../live/engine/live-engine.js";
import type { Store } from "../store/store.js";
import { createAccountService } from "./account-service.js";
import { createAdminStatic } from "./admin-static-service.js";
import { createCatalogServices } from "./catalog-services.js";
import type { CatalogJobDispatcher } from "./catalog-job-dispatcher.js";
import { createAuthService } from "./auth-service.js";
import { createChannelService } from "./channel-service.js";
import { createJobEvents } from "./job-events.js";
import { createJobProgress } from "./job-progress.js";
import { createJobRunner } from "./job-runner.js";
import { createJobService } from "./job-service.js";
import { createLogoCache } from "./logo-cache.js";
import { createLogoFill } from "./logo-fill.js";
import { createLogoResolver } from "./logo-resolver.js";
import { createRequestLimiter } from "./request-limiter.js";
import { createStreamCheck } from "./stream-check.js";
import { createPlaylistImporter } from "./playlist-import.js";
import { createPlaylistJob } from "./playlist-job.js";
import { createPlaylistService } from "./playlist-service.js";
import { createProviderService } from "./provider-service.js";
import { createSafeFetch, type SafeFetch } from "./safe-fetch.js";
import { createSecurityQuestionService } from "./security-question-service.js";
import { createSyncScheduler } from "./sync-scheduler.js";
import { seedSyncRecords } from "./sync-seed.js";
import { createTitleCatalog } from "./title-catalog-service.js";
import { createStoredTitles } from "./title-stored-service.js";
import { createUiStateService } from "./ui-state-service.js";
import { createUserCollectionsService } from "./user-collections-service.js";
import { createUserFavoritesService } from "./user-favorites-service.js";
import { createUserSettingsService } from "./user-settings-service.js";
import { createUserWatchService } from "./user-watch-service.js";

export interface ServiceOptions {
  syncExecutionMode?: "inline" | "external";
  catalogDispatcher?: CatalogJobDispatcher;
  jwtSecret: string;
  tmdbToken: string;
  tmdbBase?: string;
  tmdbMinGapMs?: number;
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
export async function createServices(store: Store, options: ServiceOptions) {
  const { now } = options;
  const external = options.syncExecutionMode === "external";
  const executionDisabledReason = external ? EXTERNAL_EXECUTION_REASON : undefined;
  const scheduleOf = async (): Promise<string> =>
    (await store.jobs.list()).find((j) => j.type === "catalog" && j.enabled && j.schedule !== "off"
      && j.config.scope !== "recent")?.schedule ?? "off";
  const { audit, tmdb, omdb, titles } = createCatalogServices(store, options, scheduleOf, executionDisabledReason);
  const auth = createAuthService({ store, audit, secret: options.jwtSecret, now });
  const securityQuestions = createSecurityQuestionService({
    store, audit, revokeAll: auth.revokeAll, secret: options.jwtSecret, now,
  });
  const live = createLiveEngine({
    cacheDir: options.cacheDir,
    dataDir: options.dataDir,
    now,
    log: options.log,
    knows: async (id) => {
      const record = await store.channels.find(id);
      return record?.kind === "live" && record.enabled;
    },
    ...(options.live && { seams: options.live }),
  });
  options.live?.onEngine?.(live);

  // The first start seeds the catalog job from the environment; after that it is the truth. Playlists come from imports.
  await seedSyncRecords(store, { titleSchedule: options.titleSchedule }, now());
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
  const events = createJobEvents({ progress, enabled: !external });
  const runner = createJobRunner({
    store, audit, now, titles, progress, executionDisabledReason, catalogDispatcher: options.catalogDispatcher,
    playlistJob: createPlaylistJob({
      store, importer, now, logoCache,
      fillLogos: createLogoFill({ store, resolver }),
      checkStreams: createStreamCheck({ store, safeFetch, limiter, now }),
    }),
    onSettled: () => scheduler.arm(),
  });
  const scheduler = createSyncScheduler({ store, runner, now, tmdbConfigured: options.tmdbToken !== "", enabled: !external });
  // The watch service reads the account's settings document at each write, so it is built after it.
  const userSettings = createUserSettingsService({ store, now });
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
    userSettings,
    userFavorites: createUserFavoritesService({ store, now }),
    userCollections: createUserCollectionsService({ store, now }),
    userWatch: createUserWatchService({ store, settings: userSettings, now }),
    channels: createChannelService({ store, audit, live, now, executionDisabledReason }),
    providers: createProviderService({ store, audit, now }),
    titles,
    storedTitles: createStoredTitles(store),
    titleCatalog: createTitleCatalog(store),
    playlists: createPlaylistService({ store, audit, runner, onChange: scheduler.arm }),
    jobs: createJobService({ store, audit, now, runner, progress, onChange: scheduler.arm }),
    hasAccounts: async (): Promise<boolean> => (await store.accounts.count()) > 0,
    purgeExpiredSessions: async (): Promise<void> => {
      await store.refreshTokens.purgeExpired(now());
    },
    health: async () => ({
      role: APP_ROLE,
      version: APP_VERSION,
      revision: await store.revisions.current(),
      tmdb: options.tmdbToken !== "" ? ("configured" as const) : ("absent" as const),
      liveChannels: await store.channels.countLive(),
    }),
  };
}

export type Services = Awaited<ReturnType<typeof createServices>>;
