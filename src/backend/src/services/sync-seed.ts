import type { Store } from "../store/store.js";
import { normaliseSchedule } from "./job-schedule.js";
import { DEFAULT_DISCOVER_PAGES } from "./title-shapes.js";

/**
 * First start only (docs/26 section 3.11): the environment seeds the records. Each `PLAYLIST_URLS` entry becomes a
 * playlist and a playlist job for it (its schedule `PLAYLIST_SYNC_SCHEDULE`, enabled when that is set); the catalog
 * job - the library fill, scope `discover` (`03` section 7.6b) - is made, enabled when `TMDB_SYNC_SCHEDULE` is set.
 * The four per-slice catalog jobs are retired: no longer seeded. After this the records are the truth and the
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
    store.jobs.insert({
      name: "Library fill",
      type: "catalog",
      enabled: titleSchedule !== "off",
      schedule: titleSchedule,
      config: { scope: "discover", pages: DEFAULT_DISCOVER_PAGES },
    }, now);
    store.jobs.markSeeded(now);
  });
}
