import type { SyncRequest } from "./title-shapes.js";
import { type PhaseRun, isStopping } from "./title-run.js";

/** The Library update's three phases, injected by `title-sync.ts`. */
export interface UpdatePhases {
  recent: (run: PhaseRun) => Promise<void>;
  changes: (request: SyncRequest, run: PhaseRun) => Promise<string[]>;
  refresh: (run: PhaseRun, mode: { changed: readonly string[] }) => Promise<void>;
}

/**
 * The Library update (docs/49 section 2.2), one run and one bar: `recent` (the titles released lately, stored like the
 * fill's walk), `changes` (the stored titles TMDB edited since the cursor) and `refresh` (the details of this run: the
 * changed titles forced, plus the gaps). A stop between phases ends the run where it stands; every write is an upsert, so
 * the next run covers the same ground again.
 */
export function createLibraryUpdate(phases: UpdatePhases) {
  return async function update(request: SyncRequest, run: PhaseRun): Promise<void> {
    await phases.recent(run);
    if (isStopping(run)) return;
    const changed = await phases.changes(request, run);
    run.seen.changed = changed.length;
    if (isStopping(run)) return;
    await phases.refresh(run, { changed });
  };
}
