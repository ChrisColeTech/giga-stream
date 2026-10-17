import { scanFolder } from "../../../shared/media/dist/scan/folder-scan.js";
import { SCAN_EVENT_BUFFER } from "../constants/media-files.js";
import { AppError } from "../lib/app-error.js";
import type { CollectionRepository, FolderRow } from "../store/collection-repository.js";
import type { LocalFileRepository } from "../store/local-file-repository.js";
import { publicScanEvent, type PublicScanEvent } from "../types/scan-event.js";
import type { JobRunner, JobService } from "./job-service.js";
import type { PosterFetchService } from "./poster-fetch.js";

interface ScanRun {
  jobId: string;
  events: PublicScanEvent[];
  readers: Map<number, { onEvent: Reader; onEnd: () => void }>;
  ended: boolean;
  found: number;
  probed: number;
}

type Reader = (event: PublicScanEvent) => void;

export interface ScanStream {
  snapshot: readonly PublicScanEvent[];
  subscribe: (onEvent: Reader, onEnd: () => void) => () => void;
}

export interface ScanService {
  queueScan: (folderId: string) => void;
  runner: JobRunner;
  scanning: (folderId: string) => boolean;
  readStream: (folderId: string) => ScanStream | undefined;
  cancel: (folderId: string) => void;
  /** Ends and forgets a folder's process-local channel before its persisted folder is removed. */
  discard: (folderId: string) => void;
}

const notFound = (): AppError =>
  new AppError("collection.not_found", 404, "There is no such collection.");

function displayTitle(relativePath: string): string {
  const base = relativePath.split("/").at(-1) ?? relativePath;
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(0, dot) : base;
}

const newRun = (jobId: string): ScanRun => ({
  jobId,
  events: [],
  readers: new Map(),
  ended: false,
  found: 0,
  probed: 0,
});

export function createScanService(deps: {
  jobs: JobService;
  folders: CollectionRepository;
  files: LocalFileRepository;
  posters: PosterFetchService;
  now: () => number;
}): ScanService {
  const { jobs, folders, files, posters, now } = deps;
  const runs = new Map<string, ScanRun>();
  let readerId = 0;

  function announce(run: ScanRun, event: PublicScanEvent): void {
    run.events.push(event);
    if (run.events.length > SCAN_EVENT_BUFFER) run.events.shift();
    if (event.type === "found") run.found += 1;
    if (event.type === "probed") run.probed += 1;
    for (const reader of [...run.readers.values()]) reader.onEvent(event);
  }

  function end(run: ScanRun): void {
    if (run.ended) return;
    run.ended = true;
    for (const reader of run.readers.values()) reader.onEnd();
    run.readers.clear();
  }

  jobs.observe(({ type, job }) => {
    if (job.kind !== "folder-scan" || job.folderId === undefined) return;
    const run = runs.get(job.folderId);
    if (run === undefined || run.jobId !== job.id) return;
    if (type === "dismissed") {
      runs.delete(job.folderId);
      return;
    }
    if (job.state === "cancelled" && !run.events.some((event) => event.type === "cancelled")) {
      announce(run, { type: "cancelled", found: run.found, probed: run.probed });
    }
    end(run);
    if (job.state !== "done" && job.state !== "cancelled") runs.delete(job.folderId);
  });

  const requireFolder = (folderId: string): FolderRow => {
    const folder = folders.findFolder(folderId);
    if (folder === null) throw notFound();
    return folder;
  };

  const titleOf = (folder: FolderRow): string => `Scanning ${folder.name}`;

  const service: ScanService = {
    queueScan(folderId) {
      const folder = requireFolder(folderId);
      const previous = runs.get(folderId);
      if (previous !== undefined && !previous.ended) {
        throw new AppError("job.running", 409, "That folder is already being scanned.");
      }
      const jobId = jobs.enqueue("folder-scan", titleOf(folder), { folderId });
      runs.set(folderId, newRun(jobId));
    },

    scanning: (folderId) => runs.get(folderId)?.ended === false,

    readStream(folderId) {
      requireFolder(folderId);
      const run = runs.get(folderId);
      if (run === undefined) return undefined;
      if (run.ended && !run.events.some((event) => event.type === "done" || event.type === "cancelled")) {
        runs.delete(folderId);
        return undefined;
      }
      return {
        snapshot: run.events.slice(),
        subscribe(onEvent, onEnd) {
          if (run.ended) {
            onEnd();
            return () => undefined;
          }
          const id = ++readerId;
          run.readers.set(id, { onEvent, onEnd });
          return () => void run.readers.delete(id);
        },
      };
    },

    cancel(folderId) {
      const run = runs.get(folderId);
      if (run === undefined || run.ended) return;
      try {
        jobs.cancel(run.jobId);
      } catch {
        end(run);
      }
    },

    discard(folderId) {
      const run = runs.get(folderId);
      if (run !== undefined) end(run);
      runs.delete(folderId);
    },

    runner: async (context): Promise<void> => {
      if (!("folderId" in context.request)) {
        throw new AppError("internal.failure", 500, "A scan job needs a folder id.");
      }
      const folder = requireFolder(context.request.folderId);
      const run = runs.get(folder.id) ?? newRun(context.jobId);
      if (run.jobId !== context.jobId) return;
      runs.set(folder.id, run);
      const keepPaths: string[] = [];
      try {
        for await (const event of scanFolder(folder.path, { signal: context.signal })) {
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
            if (row !== null) files.writeFacts({
              id: row.id,
              facts: event.facts,
              ...(event.facts.playable ? {} : { errorCode: "media.unplayable" }),
            });
          } else if (event.type === "progress") {
            context.report(event.total === null ? null : Math.round((event.probed / event.total) * 100));
          } else if (event.type === "done") {
            folders.setFolderScannedAt(folder.id, now());
            files.deleteMissing(folder.id, keepPaths);
          }
          // A terminal success is public only after its database consequences have committed.
          announce(run, publicScanEvent(event));
        }
      } finally {
        end(run);
      }
    },
  };
  return service;
}
