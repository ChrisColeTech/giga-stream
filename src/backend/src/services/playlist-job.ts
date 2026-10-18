import { AppError, ERRORS } from "../constants/errors.js";
import type { PlaylistJob } from "../store/job-repository.js";
import type { Store } from "../store/store.js";
import type { PlaylistCounts, RunCounts, RunResult } from "../types/job-counts.js";
import type { PlaylistImporter } from "./playlist-import.js";

/** What one run of a job produced: how it ended, and the typed counts the job keeps. */
export interface RunOutcome {
  result: RunResult;
  counts: RunCounts;
}

const NOTHING = { created: 0, updated: 0, skipped: 0, refused: 0, refusalExamples: [] as string[] };

/**
 * The body of a playlist's sync job (docs/43 section 3.4). This wave runs step 2 only: a `file` playlist is never
 * re-read (its upload was the read); a `url` playlist is fetched on every run through the guarded fetch and imported
 * (create and update, never delete), and a fetch that fails is `source: unreachable` while the run is still `ok`. The
 * logo and stream steps (3 to 5) arrive with their own counts; until then those counts are the honest ones: nothing
 * cached, and every channel's verdict is what the store holds (not checked).
 */
export function createPlaylistJob(deps: { store: Store; importer: PlaylistImporter }) {
  const { store, importer } = deps;

  return async function runPlaylistJob(job: PlaylistJob, signal: AbortSignal): Promise<RunOutcome> {
    const playlist = store.playlists.find(job.playlistId);
    if (!playlist) throw new AppError(ERRORS.playlistNotFound, { id: job.playlistId });
    let source: PlaylistCounts["source"] = "file";
    let changes = NOTHING;
    if (playlist.kind === "url" && !signal.aborted) {
      const refreshed = await importer.refresh(playlist, signal);
      source = refreshed.source;
      changes = refreshed.counts;
    }
    const health = store.channels.countsByPlaylist().get(playlist.id);
    const channels = health?.channels ?? 0;
    const live = health?.live ?? 0;
    const dead = health?.dead ?? 0;
    const counts: PlaylistCounts = {
      ...changes, source, logosCached: 0, logosFailed: 0, live, dead, unchecked: channels - live - dead,
      ...(signal.aborted && { stopped: true }),
    };
    return { result: signal.aborted ? "stopped" : "ok", counts };
  };
}

export type PlaylistJobBody = ReturnType<typeof createPlaylistJob>;
