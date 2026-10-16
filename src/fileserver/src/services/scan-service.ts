import { scanFolder } from "../../../shared/media/dist/scan/folder-scan.js";
import type { ScanEvent } from "../../../shared/media/dist/types/scan.js";
import { SCAN_EVENT_BUFFER } from "../constants/media-files.js";
import { AppError } from "../lib/app-error.js";
import type { CollectionRepository, FolderRow } from "../store/collection-repository.js";
import type { LocalFileRepository } from "../store/local-file-repository.js";
import type { JobRunner, JobService } from "./job-service.js";
import type { PosterFetchService } from "./poster-fetch.js";

/** The events of one running scan and every reader below it (the NDJSON route's hold). */
interface ScanRun {
  events: ScanEvent[];
  readers: Map<number, { onEvent: (event: ScanEvent) => void; onEnd: () => void }>;
}

type Reader = (event: ScanEvent) => void;

export interface ScanStream {
  /** A fixed snapshot for the catch-up of a reader that attaches late (bounded, the brief). */
  snapshot: readonly ScanEvent[];
  /** Subscribes to the live stream; `onEnd` arrives when the scan stops without a last event. */
  subscribe: (onEvent: Reader, onEnd: () => void) => () => void;
}

export interface ScanService {
  /** One scan per folder at a time: a second while one is queued or running is `409 job.running`. */
  queueScan: (folderId: string) => void;
  /** The runner one registers for kind `folder-scan` (3.9). */
  runner: JobRunner;
  /** `true` while a scan for the folder is queued or running — a queued one is still going. */
  scanning: (folderId: string) => boolean;
  /** A late NDJSON reader, or undefined -> the route answers `409 job.not_running` (3.8). */
  readStream: (folderId: string) => ScanStream | undefined;
  /** Folder removal cancels the folder's scan; a settled job is left alone. */
  cancel: (folderId: string) => void;
}

const notFound = (): AppError =>
  new AppError("collection.not_found", 404, "There is no such collection.");

function displayTitle(relativePath: string): string {
  const base = relativePath.split("/").at(-1) ?? relativePath;
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(0, dot) : base;
}

export function createScanService(deps: {
  jobs: JobService;
  folders: CollectionRepository;
  files: LocalFileRepository;
  posters: PosterFetchService;
  now: () => number;
}): ScanService {
  const { jobs, folders, files, posters, now } = deps;
  /** folder id -> its live scan; a late client catches up from the bounded buffer. */
  const running = new Map<string, ScanRun>();
  /** folder id -> the job id of a queued or running scan (one scan per folder, 3.8). */
  const activeJobs = new Map<string, string>();
  let readerId = 0;

  const queuedId = (folderId: string): string | undefined => {
    const jobId = activeJobs.get(folderId);
    if (jobId === undefined) return undefined;
    let state: string | undefined;
    try {
      state = jobs.get(jobId).state;
    } catch {
      state = undefined; // The job row was dismissed; the folder is free again.
    }
    if (state === "queued" || state === "running" || state === "cancelling") return jobId;
    activeJobs.delete(folderId);
    return undefined;
  };

  function announce(run: ScanRun, event: ScanEvent): void {
    run.events.push(event);
    if (run.events.length > SCAN_EVENT_BUFFER) run.events.shift();
    for (const reader of run.readers.values()) reader.onEvent(event);
  }

  function titleOf(folder: FolderRow): string {
    return `Scanning ${folder.name}`;
  }

  return {
    queueScan(folderId) {
      const folder = folders.findFolder(folderId);
      if (folder === null) throw notFound();
      if (running.has(folderId) || queuedId(folderId) !== undefined) {
        throw new AppError("job.running", 409, "That folder is already being scanned.");
      }
      const jobId = jobs.enqueue("folder-scan", titleOf(folder), { folderId });
      activeJobs.set(folderId, jobId);
    },

    scanning(folderId) {
      return running.has(folderId) || queuedId(folderId) !== undefined;
    },

    readStream(folderId) {
      const run = running.get(folderId);
      if (run === undefined) return undefined;
      const snapshot = run.events.slice();
      const map = run.readers;
      return {
        snapshot,
        subscribe(onEvent, onEnd) {
          const id = ++readerId;
          map.set(id, { onEvent, onEnd });
          return () => void map.delete(id);
        },
      };
    },

    cancel(folderId) {
      const jobId = queuedId(folderId);
      if (jobId === undefined) return;
      try {
        jobs.cancel(jobId);
      } catch {
        // The job settled in between (for example by cancel route); nothing hangs on it.
      }
      activeJobs.delete(folderId);
    },

    runner: async (context): Promise<void> => {
      if (!("folderId" in context.request)) {
        throw new AppError("internal.failure", 500, "A scan job needs a folder id.");
      }
      const folderId = context.request.folderId;
      const folder = folders.findFolder(folderId);
      if (folder === null) throw notFound();
      const run: ScanRun = { events: [], readers: new Map() };
      activeJobs.delete(folderId);
      running.set(folderId, run);
      const keepPaths: string[] = [];
      try {
        for await (const event of scanFolder(folder.path, { signal: context.signal })) {
          announce(run, event);
          if (event.type === "found") {
            keepPaths.push(event.file.path);
            const row = files.recordFileInfo({
              folderId: folder.id,
              collectionId: folder.collectionId,
              path: event.file.path,
              title: displayTitle(event.file.path),
              sizeBytes: event.file.sizeBytes,
              mtimeMs: event.file.modifiedMs,
              at: now(),
            });
            if (row.isNewOrChanged) posters.queue(row.id, row.title);
          } else if (event.type === "probed") {
            const row = files.findByPath(folder.id, event.file.path);
            if (row !== null) {
              // The unplayable rows carry the marker code so the client can name the problem (3.8).
              files.writeFacts({
                id: row.id,
                facts: event.facts,
                ...(event.facts.playable ? {} : { errorCode: "media.unplayable" }),
              });
            }
          } else if (event.type === "progress") {
            const percent = event.total === null ? 0 : Math.round((event.probed / event.total) * 100);
            context.report(percent);
          } else if (event.type === "done") {
            folders.setFolderScannedAt(folder.id, now());
            files.deleteMissing(folder.id, keepPaths);
          }
        }
      } finally {
        for (const reader of run.readers.values()) reader.onEnd();
        running.delete(folderId);
      }
    },
  };
}
