import { createHash } from "node:crypto";
import path from "node:path";

import { IMAGE_ID_LENGTH, STILL_SUFFIX } from "../constants/media-cache.js";
import { locateTool } from "../../../shared/media/src/ffmpeg/locate-tool.ts";
import { runTool } from "../../../shared/media/src/ffmpeg/run-tool.ts";
import type { JobContext, JobRunner } from "./job-service.js";
import type { LocalFileRepository } from "../store/local-file-repository.js";
import type { CollectionRepository } from "../store/collection-repository.js";
import type { ImageCacheService } from "./image-cache-service.js";
import { AppError } from "../lib/app-error.js";

/**
 * The still job (docs/03 sections 3.8 and 3.11): one frame of a local file with ffmpeg's
 * `thumbnail` filter, written straight into the image cache, its id set on the file's row. The id
 * derives from the file's folder-relative path (as the archive's `poster-id.ts` hashed) so a rescan
 * keeps the same id.
 */
export interface PosterFetchService {
  /** Enqueues a still for one file row; the label names the file, never its path (3.9). */
  queue: (localFileId: string, title: string) => void;
  runner: JobRunner;
}

const STILL_ARGS = ["-hide_banner", "-loglevel", "error", "-nostdin", "-y"];

/** The folder-relative id: the same file keeps the same still id across rescans (the brief). */
export function stillIdOf(folderRelativePath: string): string {
  return createHash("sha256").update(folderRelativePath).digest("hex").slice(0, IMAGE_ID_LENGTH);
}

export function createPosterFetchService(deps: {
  images: ImageCacheService;
  files: LocalFileRepository;
  folders: CollectionRepository;
  enqueue: (kind: "poster-fetch", label: string, request: { localFileId: string }) => string;
}): PosterFetchService {
  const { images, files, folders, enqueue } = deps;

  return {
    queue(localFileId, title) {
      enqueue("poster-fetch", `Capturing a still of ${title}`, { localFileId });
    },

    runner: async (context: JobContext): Promise<void> => {
      if (!("localFileId" in context.request)) {
        throw new AppError("internal.failure", 500, "A still job needs a file id.");
      }
      const row = files.find(context.request.localFileId);
      if (row === null) {
        throw new AppError("media.not_found", 404, "That file is no longer in the fileserver.");
      }
      const folder = folders.findFolder(row.folderId);
      if (folder === null) {
        throw new AppError("media.not_found", 404, "That file's folder is no longer attached.");
      }
      const id = stillIdOf(row.path);
      if (images.has(id)) return;
      const target = path.join(images.dir, `${id}${STILL_SUFFIX}`);
      const fullPath = path.join(folder.path, row.path);
      await runTool(locateTool("ffmpeg"), [...STILL_ARGS, "-i", fullPath, "-vf", "thumbnail", "-frames:v", "1", target], {
        signal: context.signal,
      });
      files.writePosterId(row.id, id);
      images.rememberStill(id);
    },
  };
}
