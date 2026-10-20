import { randomUUID } from "node:crypto";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import type { FileserverApp } from "./app-fixture.js";

/** Inserts one indexed local file into the app's temporary local store. */
export function localFile(
  app: FileserverApp,
  title: string,
  options: { height?: number; posterId?: string; addedAt?: number; collectionId?: string } = {},
): string {
  const database = new DatabaseSync(path.join(app.dataDir, "giga-stream.db"));
  const collectionId = options.collectionId ?? `col_${randomUUID()}`;
  const folderId = `folder_${randomUUID()}`;
  const id = `file_${randomUUID()}`;
  const at = options.addedAt ?? app.clock.now();
  if (options.collectionId === undefined) {
    database.prepare(
      "INSERT INTO collections (id, name, type, created_at, updated_at) VALUES (?, ?, 'local', ?, ?)",
    ).run(collectionId, `Collection ${id}`, at, at);
  }
  database.prepare(
    "INSERT INTO collection_folders (id, collection_id, path, name, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(folderId, collectionId, path.join(app.dataDir, folderId), "Folder", at);
  database.prepare(
    `INSERT INTO local_files (id, folder_id, collection_id, path, title, height, playable, poster_id, added_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
  ).run(id, folderId, collectionId, path.join(app.dataDir, folderId, title), title,
    options.height ?? null, options.posterId ?? null, at);
  database.close();
  return id;
}
