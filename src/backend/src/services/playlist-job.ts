import { AppError, ERRORS } from "../constants/errors.js";
import { SYNC_RUN_MAX_MS } from "../constants/limits.js";
import type { PlaylistJob } from "../store/job-repository.js";
import type { Store } from "../store/store.js";
import type { PlaylistCounts, RunCounts, RunResult } from "../types/job-counts.js";
import type { SyncRun } from "../types/sync-run.js";
import type { LogoCache } from "./logo-cache.js";
import type { LogoFill } from "./logo-fill.js";
import type { PlaylistImporter } from "./playlist-import.js";
import type { StreamCheck } from "./stream-check.js";

/** What one run of a job produced: how it ended, and the typed counts the job keeps. */
export interface RunOutcome {
  result: RunResult;
  counts: RunCounts;
}

const NOTHING = { created: 0, updated: 0, skipped: 0, refused: 0, refusalExamples: [] as string[] };

/**
 * The body of a playlist's sync job (docs/43 section 3.4). (1) A `file` playlist is never re-read (its upload was the
 * read); a `url` playlist is fetched on every run through the guarded fetch and imported (create and update, never
 * delete); a fetch that fails is `source: unreachable` and the run goes on. (3) Missing logo addresses are filled from
 * the iptv-org index, (4) logo bytes are cached, (5) each stream address is checked. A stop ends the run between and
 * inside the steps with everything already written kept: `stopped`. The live, dead and unchecked counts are what the
 * store holds when the run ends, so a resumed run reports the whole playlist.
 */
export function createPlaylistJob(deps: {
  store: Store;
  importer: PlaylistImporter;
  fillLogos: LogoFill;
  logoCache: LogoCache;
  checkStreams: StreamCheck;
  now: () => number;
}) {
  const { store, importer, fillLogos, logoCache, checkStreams, now } = deps;

  return async function runPlaylistJob(job: PlaylistJob, signal: AbortSignal): Promise<RunOutcome> {
    const playlist = store.playlists.find(job.playlistId);
    if (!playlist) throw new AppError(ERRORS.playlistNotFound, { id: job.playlistId });
    const run: SyncRun = { playlistId: playlist.id, signal, endsAt: now() + SYNC_RUN_MAX_MS };
    let source: PlaylistCounts["source"] = "file";
    let changes = NOTHING;
    if (playlist.kind === "url" && !signal.aborted) {
      const refreshed = await importer.refresh(playlist, signal);
      source = refreshed.source;
      changes = refreshed.counts;
    }
    let logos = { cached: 0, failed: 0 };
    if (!signal.aborted) await fillLogos(run);
    if (!signal.aborted) logos = await logoCache.run(run);
    if (!signal.aborted) await checkStreams(run);
    const health = store.channels.countsByPlaylist().get(playlist.id);
    const channels = health?.channels ?? 0;
    const live = health?.live ?? 0;
    const dead = health?.dead ?? 0;
    const counts: PlaylistCounts = {
      ...changes, source, logosCached: logos.cached, logosFailed: logos.failed, live, dead, unchecked: channels - live - dead,
      ...(signal.aborted && { stopped: true }),
    };
    return { result: signal.aborted ? "stopped" : "ok", counts };
  };
}

export type PlaylistJobBody = ReturnType<typeof createPlaylistJob>;
