import { z } from "zod";

import type { MediaFacts } from "../../../shared/media/src/types/media-facts.ts";
import type { Database } from "./database.js";

/** A local_files row as the fileserver keeps it: the facts of one found file, by opaque id. */
export interface LocalFileRow {
  id: string;
  folderId: string;
  collectionId: string;
  path: string;
  title: string;
  sizeBytes?: number;
  mtimeMs?: number;
  facts: MediaFacts;
  posterId?: string;
  addedAt: number;
}

const RowSchema = z.object({
  id: z.string(),
  folder_id: z.string(),
  collection_id: z.string(),
  path: z.string(),
  title: z.string(),
  size_bytes: z.coerce.number().nullable(),
  mtime_ms: z.coerce.number().nullable(),
  duration_ms: z.coerce.number().nullable(),
  width: z.coerce.number().nullable(),
  height: z.coerce.number().nullable(),
  video_codec: z.string().nullable(),
  audio_codec: z.string().nullable(),
  container: z.string().nullable(),
  playable: z.coerce.number(),
  probe_error_code: z.string().nullable(),
  probe_error_message: z.string().nullable(),
  poster_id: z.string().nullable(),
  added_at: z.coerce.number(),
});

export interface LocalFileRepository {
  find(id: string): LocalFileRow | null;
  findByPath(folderId: string, path: string): LocalFileRow | null;
  /** Inserts when new, updates size/mtime when there; answers the row and whether it is new/changed. */
  recordFileInfo(input: {
    folderId: string;
    collectionId: string;
    path: string;
    title: string;
    sizeBytes: number;
    mtimeMs: number;
    at: number;
  }): { id: string; title: string; isNewOrChanged: boolean };
  /** Writes the probe's facts of docs/03 section 3.8 over the row. */
  writeFacts(input: { id: string; facts: MediaFacts; errorCode?: string }): void;
  /** Sets the still's image id (`poster-fetch`, 3.11). */
  writePosterId(id: string, posterId: string): void;
  /** Removes the rows of one walked folder whose path is no longer there. */
  deleteMissing(folderId: string, keepPaths: readonly string[]): void;
  deleteByFolder(folderId: string): void;
  deleteById(id: string): void;
}

const COLUMNS = `id, folder_id, collection_id, path, title, size_bytes, mtime_ms,
  duration_ms, width, height, video_codec, audio_codec, container, playable,
  probe_error_code, probe_error_message, poster_id, added_at`;

export function createLocalFileRepository(db: Database): LocalFileRepository {
  const selectById = db.prepare(`SELECT ${COLUMNS} FROM local_files WHERE id = ?`);
  const selectByPath = db.prepare(`SELECT ${COLUMNS} FROM local_files WHERE folder_id = ? AND path = ?`);
  const insert = db.prepare(
    `INSERT INTO local_files (id, folder_id, collection_id, path, title, size_bytes, mtime_ms, added_at, playable)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
  );
  const updateInfo = db.prepare("UPDATE local_files SET size_bytes = ?, mtime_ms = ? WHERE id = ?");
  const updateFacts = db.prepare(
    `UPDATE local_files SET duration_ms = ?, width = ?, height = ?, video_codec = ?, audio_codec = ?,
       container = ?, playable = ?, probe_error_code = ?, probe_error_message = ? WHERE id = ?`,
  );
  const updatePoster = db.prepare("UPDATE local_files SET poster_id = ? WHERE id = ?");
  const dropByMissing = (keep: readonly string[]) =>
    db.prepare(`DELETE FROM local_files WHERE folder_id = ? AND path NOT IN (${keep.map(() => "?").join(", ")})`);
  const dropByFolder = db.prepare("DELETE FROM local_files WHERE folder_id = ?");
  const dropById = db.prepare("DELETE FROM local_files WHERE id = ?");

  function toRow(raw: unknown): LocalFileRow | null {
    const row = RowSchema.safeParse(raw);
    if (!row.success) return null;
    return {
      id: row.data.id,
      folderId: row.data.folder_id,
      collectionId: row.data.collection_id,
      path: row.data.path,
      title: row.data.title,
      ...(row.data.size_bytes !== null && { sizeBytes: row.data.size_bytes }),
      ...(row.data.mtime_ms !== null && { mtimeMs: row.data.mtime_ms }),
      addedAt: row.data.added_at,
      facts: {
        playable: row.data.playable === 1,
        ...(row.data.duration_ms !== null && { durationMs: row.data.duration_ms }),
        ...(row.data.width !== null && { width: row.data.width }),
        ...(row.data.height !== null && { height: row.data.height }),
        ...(row.data.video_codec !== null && { videoCodec: row.data.video_codec }),
        ...(row.data.audio_codec !== null && { audioCodec: row.data.audio_codec }),
        ...(row.data.container !== null && { container: row.data.container }),
        ...(row.data.probe_error_message !== null && { problem: row.data.probe_error_message }),
      },
      ...(row.data.poster_id !== null && { posterId: row.data.poster_id }),
    };
  }

  return {
    find(id) {
      return toRow(selectById.get(id));
    },

    findByPath(folderId, path) {
      return toRow(selectByPath.get(folderId, path));
    },

    recordFileInfo(input) {
      const existing = toRow(selectByPath.get(input.folderId, input.path));
      if (existing === null) {
        const id = crypto.randomUUID();
        insert.run(
          id,
          input.folderId,
          input.collectionId,
          input.path,
          input.title,
          input.sizeBytes,
          input.mtimeMs,
          input.at,
        );
        return { id, title: input.title, isNewOrChanged: true };
      }
      if (existing.sizeBytes === input.sizeBytes && existing.mtimeMs === input.mtimeMs) {
        return { id: existing.id, title: existing.title, isNewOrChanged: false };
      }
      updateInfo.run(input.sizeBytes, input.mtimeMs, existing.id);
      return { id: existing.id, title: existing.title, isNewOrChanged: true };
    },

    writeFacts({ id, facts, errorCode }) {
      updateFacts.run(
        facts.durationMs ?? null,
        facts.width ?? null,
        facts.height ?? null,
        facts.videoCodec ?? null,
        facts.audioCodec ?? null,
        facts.container ?? null,
        facts.playable ? 1 : 0,
        errorCode ?? null,
        facts.problem ?? null,
        id,
      );
    },

    writePosterId(id, posterId) {
      updatePoster.run(posterId, id);
    },

    deleteMissing(folderId, keepPaths) {
      if (keepPaths.length === 0) {
        dropByFolder.run(folderId);
        return;
      }
      dropByMissing(keepPaths).run(folderId, ...keepPaths);
    },

    deleteByFolder(folderId) {
      dropByFolder.run(folderId);
    },

    deleteById(id) {
      dropById.run(id);
    },
  };
}
