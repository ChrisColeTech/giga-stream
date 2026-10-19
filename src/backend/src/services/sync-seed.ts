import { LIBRARY_UPDATE_NAME, LIBRARY_UPDATE_SCHEDULE } from "../constants/limits.js";
import type { Store } from "../store/store.js";
import { normaliseSchedule } from "./job-schedule.js";

/**
 * First start only (docs/26 section 3.11): the environment seeds the catalog jobs - the library fill, scope `discover`
 * (`03` section 7.6b), always `enabled` (as migration 025 makes it, docs/44 section 3.4), scheduled at
 * `TMDB_SYNC_SCHEDULE` when that is set, else `off` (runnable on demand: `Enabled` gates only the scheduled run), and the
 * Library update, scope `recent` (docs/49 section 2.7; migration 028 makes it on an existing database), enabled at a
 * literal `24h` - `TMDB_SYNC_SCHEDULE` governs the fill only. Both in one transaction.
 * Playlists are not seeded: a playlist and its job come from an import (docs/43). The four per-slice catalog jobs are
 * retired. After this the records are the truth and the environment is not read for them again, even if an admin
 * deletes them all.
 */
export async function seedSyncRecords(store: Store, env: { titleSchedule: string }, now: number): Promise<void> {
  if (await store.jobs.isSeeded()) return;
  const titleSchedule = normaliseSchedule(env.titleSchedule, "TMDB_SYNC_SCHEDULE");
  await store.transaction(async () => {
    await store.jobs.insertCatalog(
      {
        name: "Library fill",
        enabled: true,
        schedule: titleSchedule,
        config: { scope: "discover" },
      },
      now,
    );
    await store.jobs.insertCatalog(
      {
        name: LIBRARY_UPDATE_NAME,
        enabled: true,
        schedule: LIBRARY_UPDATE_SCHEDULE,
        config: { scope: "recent" },
      },
      now,
    );
    await store.jobs.markSeeded(now);
  });
}
