import type { SyncRequest } from "./title-shapes.js";
import { type PhaseRun, isStopping } from "./title-run.js";

/** The Library update's three phases, injected by `title-sync.ts`. */
export interface UpdatePhases {
  recent: (run: PhaseRun) => Promise<void>;
  /** Answers the title ids of the stored series that aired an episode in the window (the forced set). */
  airing: (request: SyncRequest, run: PhaseRun) => Promise<string[]>;
  refresh: (run: PhaseRun, mode: { forced: readonly string[] }) => Promise<void>;
}

/**
 * The Library update (docs/49 section 2), one run and one bar: `recent` (the titles released lately, stored like the
 * fill's walk), `airing` (the series with an episode airing since the cursor: stored ones are forced, new ones enter
 * list-shaped) and `refresh` (the details of this run: the forced series plus the gaps). A stop between phases ends the
 * run where it stands; every write is an upsert, so the next run covers the same ground again.
 */
export function createLibraryUpdate(phases: UpdatePhases) {
  return async function update(request: SyncRequest, run: PhaseRun): Promise<void> {
    await phases.recent(run);
    if (isStopping(run)) return;
    const forced = await phases.airing(request, run);
    run.seen.airing = forced.length;
    if (isStopping(run)) return;
    await phases.refresh(run, { forced });
  };
}
