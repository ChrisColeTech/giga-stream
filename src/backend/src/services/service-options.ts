import path from "node:path";
import type { Config } from "../config.js";
import { createCatalogJobDispatcher } from "./catalog-job-dispatcher.js";
import type { ServiceOptions } from "./service-registry.js";

/** One environment-to-service mapping, shared by both process entrypoints. */
export function serviceOptions(settings: Config, now: () => number, log: (line: string) => void): ServiceOptions {
  return {
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
    log,
    titleSchedule: settings.TMDB_SYNC_SCHEDULE,
    playlistSyncMaxBytes: settings.PLAYLIST_SYNC_MAX_BYTES,
    playlistSyncMax: settings.PLAYLIST_SYNC_MAX,
    logoIndexTtlHours: settings.LOGO_INDEX_TTL_HOURS,
    syncExecutionMode: settings.SYNC_EXECUTION_MODE,
    catalogDispatcher: createCatalogJobDispatcher({
      project: settings.CLOUD_RUN_JOB_PROJECT,
      region: settings.CLOUD_RUN_JOB_REGION,
      fillJob: settings.CLOUD_RUN_FILL_JOB,
      updateJob: settings.CLOUD_RUN_UPDATE_JOB,
    }),
  };
}
