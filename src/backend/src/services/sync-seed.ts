import type { Store } from "../store/store.js";
import { normaliseSchedule } from "./job-schedule.js";
import { DEFAULT_SYNC_PAGES } from "./title-shapes.js";

const CATALOG_JOBS = [
  { name: "Trending movies", scope: "trending", kind: "movie" },
  { name: "Trending series", scope: "trending", kind: "tv" },
  { name: "Popular movies", scope: "popular", kind: "movie" },
  { name: "Popular series", scope: "popular", kind: "tv" },
] as const;

/**
 * First start only (docs/26 section 3.11): the environment seeds the records. Each `PLAYLIST_URLS` entry becomes a
 * playlist and a playlist job for it (its schedule `PLAYLIST_SYNC_SCHEDULE`, enabled when that is set); the four
 * catalog jobs are made, enabled when `TMDB_SYNC_SCHEDULE` is set. After this the records are the truth and the
 * environment is not read for them again, even if an admin deletes them all.
 */
export function seedSyncRecords(
  store: Store,
  env: { playlistUrls: string[]; playlistSchedule: string; titleSchedule: string },
  now: number,
): void {
  if (store.jobs.isSeeded()) return;
  const playlistSchedule = normaliseSchedule(env.playlistSchedule, "PLAYLIST_SYNC_SCHEDULE");
  const titleSchedule = normaliseSchedule(env.titleSchedule, "TMDB_SYNC_SCHEDULE");
  store.transaction(() => {
    for (const address of env.playlistUrls) {
      const host = new URL(address).host;
      const playlistId = store.playlists.insert({ name: host, address, host, enabled: true }, now);
      store.jobs.insert({
        name: `Sync ${host}`,
        type: "playlist",
        enabled: playlistSchedule !== "off",
        schedule: playlistSchedule,
        config: { playlistId, dryRun: false, prune: false },
      }, now);
    }
    for (const job of CATALOG_JOBS) {
      store.jobs.insert({
        name: job.name,
        type: "catalog",
        enabled: titleSchedule !== "off",
        schedule: titleSchedule,
        config: { scope: job.scope, kind: job.kind, pages: DEFAULT_SYNC_PAGES },
      }, now);
    }
    store.jobs.markSeeded(now);
  });
}
