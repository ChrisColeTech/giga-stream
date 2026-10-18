import type { Store } from "../store/store.js";
import { normaliseSchedule } from "./job-schedule.js";
import { DEFAULT_DISCOVER_PAGES } from "./title-shapes.js";

/**
 * First start only (docs/26 section 3.11): the environment seeds the catalog job - the library fill, scope `discover`
 * (`03` section 7.6b) - enabled when `TMDB_SYNC_SCHEDULE` is set. Playlists are not seeded: a playlist and its job
 * come from an import (docs/43). The four per-slice catalog jobs are retired. After this the records are the truth and
 * the environment is not read for them again, even if an admin deletes them all.
 */
export function seedSyncRecords(store: Store, env: { titleSchedule: string }, now: number): void {
  if (store.jobs.isSeeded()) return;
  const titleSchedule = normaliseSchedule(env.titleSchedule, "TMDB_SYNC_SCHEDULE");
  store.transaction(() => {
    store.jobs.insertCatalog(
      {
        name: "Library fill",
        enabled: titleSchedule !== "off",
        schedule: titleSchedule,
        config: { scope: "discover", pages: DEFAULT_DISCOVER_PAGES },
      },
      now,
    );
    store.jobs.markSeeded(now);
  });
}
