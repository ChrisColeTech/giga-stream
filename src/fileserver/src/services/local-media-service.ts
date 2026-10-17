import { createReadStream, existsSync, statSync } from "node:fs";
import type { ServerResponse } from "node:http";
import path from "node:path";

import { AppError } from "../lib/app-error.js";
import type { LocalFileInfo, MediaPlan } from "../types/local-file.js";
import type { CollectionRepository } from "../store/collection-repository.js";
import type { LocalFileRepository } from "../store/local-file-repository.js";

const notFound = (): AppError => new AppError("media.not_found", 404, "There is no such file.");

const unsatisfiable = (): AppError =>
  new AppError("playback.range_invalid", 416, "That video range cannot be served.");

/** The container map (docs/03 section 3.8); unknown extensions fall to `application/octet-stream`. */
const CONTENT_TYPES: ReadonlyMap<string, string> = new Map([
  [".mp4", "video/mp4"],
  [".m4v", "video/x-m4v"],
  [".mkv", "video/x-matroska"],
  [".webm", "video/webm"],
  [".mov", "video/quicktime"],
  [".avi", "video/x-msvideo"],
  [".ts", "video/mp2t"],
]);

/** One byte range at most; `Range: bytes=start-end`, `bytes=start-` or `bytes=-suffix` (3.10). */
export function readRange(range: string | undefined, size: number): { start: number; end: number } | undefined {
  const raw = range?.trim();
  if (raw === undefined || raw === "") return undefined;
  if (!raw.startsWith("bytes=") || raw.includes(",")) throw unsatisfiable();
  const body = raw.slice("bytes=".length);
  const dash = body.indexOf("-");
  if (dash < 0) throw unsatisfiable();
  const startPart = body.slice(0, dash).trim();
  const endPart = body.slice(dash + 1).trim();
  const whole = startPart === "" && endPart === "";
  const numeric = (value: string): number | null => (/^\d+$/.test(value) ? Number(value) : null);
  const start = startPart === "" ? null : numeric(startPart);
  const end = endPart === "" ? null : numeric(endPart);
  if (whole || (startPart !== "" && start === null) || (endPart !== "" && end === null)) throw unsatisfiable();
  const first = start ?? Math.max(0, size - (end ?? 1));
  if (((end ?? 0) === 0 && start === null && endPart !== "") || first >= size || first < 0) throw unsatisfiable();
  const last = start === null ? size - 1 : Math.min(end ?? size - 1, size - 1);
  if (last < first) throw unsatisfiable();
  return { start: first, end: last };
}

export interface LocalMediaService {
  /** The Player-details answer of `GET .../info` (3.10), or `404 media.not_found`. */
  info: (localFileId: string) => LocalFileInfo;
  /**
   * A full or single-range plan (3.10): strong ETag, `If-Range` honored only on an exact match. A
   * file gone from disk is `404`; a malformed or unsatisfiable range is `416 playback.range_invalid`.
   */
  plan: (localFileId: string, headers: { range?: string; ifRange?: string }) => MediaPlan;
  /** Writes the plan's head, then streams the bytes; an abandoned request stops reading. */
  serve: (plan: MediaPlan, head: boolean, response: ServerResponse) => Promise<void>;
}

export function createLocalMediaService(deps: {
  files: LocalFileRepository;
  collections: CollectionRepository;
}): LocalMediaService {
  const { files, collections } = deps;

  const etagOf = (id: string, sizeBytes: number, mtimeMs: number): string => `"local-${id}-${sizeBytes}-${mtimeMs}"`;

  return {
    info(localFileId) {
      const row = files.find(localFileId);
      if (row === null) throw notFound();
      const folder = collections.findFolder(row.folderId);
      return {
        id: row.id,
        title: row.title,
        ...(row.facts.durationMs !== undefined && { durationMs: row.facts.durationMs }),
        ...(row.sizeBytes !== undefined && { sizeBytes: row.sizeBytes }),
        ...(row.facts.width !== undefined && { width: row.facts.width }),
        ...(row.facts.height !== undefined && { height: row.facts.height }),
        ...(row.facts.videoCodec !== undefined && { videoCodec: row.facts.videoCodec }),
        ...(row.facts.audioCodec !== undefined && { audioCodec: row.facts.audioCodec }),
        ...(row.facts.container !== undefined && { container: row.facts.container }),
        playable: row.facts.playable,
        ...(!row.facts.playable && {
          error: {
            code: "media.unplayable",
            message: row.facts.problem ?? "ffprobe could not read this file.",
          },
        }),
        collectionIds: collections.collectionsOfItem("local", row.id).map((membership) => membership.collectionId),
        folderName: folder?.name ?? "",
      };
    },

    plan(localFileId, headers) {
      const row = files.find(localFileId);
      if (row === null) throw notFound();
      const folder = collections.findFolder(row.folderId);
      if (folder === null) throw notFound();
      const fullPath = path.join(folder.path, row.path);
      if (!existsSync(fullPath) || !statSync(fullPath).isFile()) throw notFound();
      const size = statSync(fullPath).size;
      const etag = etagOf(localFileId, size, row.mtimeMs ?? 0);
      const wanted = readRange(headers.range, size);
      const honored = wanted !== undefined && (headers.ifRange === undefined || headers.ifRange === etag);
      let start = 0;
      let end = size - 1;
      if (honored && wanted !== undefined) {
        start = wanted.start;
        end = wanted.end;
      }
      return {
        status: honored ? 206 : 200,
        headers: {
          "content-type": CONTENT_TYPES.get(path.extname(fullPath).toLowerCase()) ?? "application/octet-stream",
          "content-length": String(end - start + 1),
          "accept-ranges": "bytes",
          etag,
          "last-modified": new Date(row.mtimeMs ?? 0).toUTCString(),
          ...(honored && { "content-range": `bytes ${start}-${end}/${size}` }),
        },
        fullPath,
        start,
        end,
      };
    },

    async serve(plan, head, response) {
      response.writeHead(plan.status, plan.headers);
      if (head || plan.end < plan.start) {
        response.end();
        return;
      }
      const stream = createReadStream(plan.fullPath, { start: plan.start, end: plan.end });
      response.on("close", () => stream.destroy());
      stream.pipe(response);
      await new Promise<void>((resolve) => stream.on("close", resolve));
    },
  };
}
