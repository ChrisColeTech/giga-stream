import {
  LIBRARY_WALK_SHARE, PLAYLIST_LOGOS_SHARE, PROGRESS_MIN_GAP_MS, UPDATE_AIRING_SHARE, UPDATE_RECENT_SHARE,
} from "../constants/limits.js";
import type { JobEvent, JobFinished, JobProgress, ProgressReport, ProgressUpdate } from "../types/job-progress.js";

const unit = (update: ProgressUpdate): number =>
  update.total > 0 ? Math.min(Math.max(update.done / update.total, 0), 1) : 0;

/**
 * How far a run is, 0 to 1, from its latest report (docs/44 section 3.1). Fixed phase weights: a playlist run reads (0),
 * fills logos (0 to 20%) and checks streams (20 to 100%); the Library fill walks movies then series (0 to 10%, a half
 * each) and fetches `details` (10 to 100%; a series' episodes ride its detail calls); the Library update reads `recent`
 * (0 to 10%), `airing` (10 to 20%) and `refresh` (20 to 100%, docs/49); any other phase fills the whole bar. Before a
 * phase's total is known it reads its lower bound. The admin keeps its own copy of these weights (the programs never
 * import each other).
 */
export function fractionOf(update: ProgressUpdate): number {
  const share = unit(update);
  switch (update.phase) {
    case "reading": return 0;
    case "logos": return PLAYLIST_LOGOS_SHARE * share;
    case "checking": return PLAYLIST_LOGOS_SHARE + (1 - PLAYLIST_LOGOS_SHARE) * share;
    case "movies": return (LIBRARY_WALK_SHARE / 2) * share;
    case "tv": return LIBRARY_WALK_SHARE / 2 + (LIBRARY_WALK_SHARE / 2) * share;
    case "details": return LIBRARY_WALK_SHARE + (1 - LIBRARY_WALK_SHARE) * share;
    case "recent": return UPDATE_RECENT_SHARE * share;
    case "airing": return UPDATE_RECENT_SHARE + (UPDATE_AIRING_SHARE - UPDATE_RECENT_SHARE) * share;
    case "refresh": return UPDATE_AIRING_SHARE + (1 - UPDATE_AIRING_SHARE) * share;
    default: return share;
  }
}

interface Entry {
  progress: JobProgress;
  /** The greatest fraction reported: a report below it is dropped, so the bar never goes backwards. */
  fraction: number;
  /** The last value that reached the stream, and when (the clock's `now()`). */
  sent: { phase: string; total: number; at: number };
}

/**
 * The registry of running jobs' progress (docs/44 section 3.1): the latest value per job, kept while the run lasts and
 * forgotten by `finish`. Every change is published to the listeners, except that same-phase `done` increments reach
 * them at most `PROGRESS_EVENTS_PER_SECOND` times a second per job, judged by the injected clock; a phase change, a
 * new total, `done === total` and `finish` are never held back. There are no timers here.
 */
export function createJobProgress(deps: { now: () => number }) {
  const { now } = deps;
  const entries = new Map<number, Entry>();
  const listeners = new Set<(event: JobEvent) => void>();

  const publish = (event: JobEvent): void => {
    for (const listener of [...listeners]) listener(event);
  };

  function send(entry: Entry): void {
    entry.sent = { phase: entry.progress.phase, total: entry.progress.total, at: now() };
    publish({ type: "progress", progress: { ...entry.progress } });
  }

  return {
    /** Registers a run at `phase` (0 of 0) and answers the function its job reports through. */
    start(jobId: number, phase: string): ProgressReport {
      const entry: Entry = {
        progress: { jobId, phase, done: 0, total: 0 },
        fraction: 0,
        sent: { phase, total: 0, at: now() },
      };
      entries.set(jobId, entry);
      send(entry);
      return (update) => {
        if (entries.get(jobId) !== entry) return; // the run has ended (or a newer one began): a late report is dropped
        const fraction = fractionOf(update);
        if (fraction < entry.fraction) return;
        entry.fraction = fraction;
        entry.progress = { jobId, phase: update.phase, done: update.done, total: update.total };
        const { sent } = entry;
        const held = update.phase === sent.phase && update.total === sent.total && update.done !== update.total
          && now() - sent.at < PROGRESS_MIN_GAP_MS;
        if (!held) send(entry);
      };
    },

    get: (jobId: number): JobProgress | undefined => {
      const found = entries.get(jobId);
      return found === undefined ? undefined : { ...found.progress };
    },

    /** Every running job's latest progress (the stream's `snapshot`). */
    running: (): JobProgress[] => [...entries.values()].map((entry) => ({ ...entry.progress })),

    /** The run ended: its progress is forgotten and `finished` goes out, always. */
    finish(finished: JobFinished): void {
      entries.delete(finished.jobId);
      publish({ type: "finished", ...finished });
    },

    subscribe(listener: (event: JobEvent) => void): () => void {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

export type JobProgressRegistry = ReturnType<typeof createJobProgress>;
