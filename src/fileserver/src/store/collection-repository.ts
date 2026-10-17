import { z } from "zod";

import type { CollectionType } from "../types/collection.js";
import type { Database } from "./database.js";

/** Rows of the user's own data tables. `path` is private and never crosses into a DTO (001 header). */
export interface CollectionRow {
  id: string;
  name: string;
  type: CollectionType;
  createdAt: number;
  updatedAt: number;
}

export interface FolderRow {
  id: string;
  collectionId: string;
  path: string;
  name: string;
  lastScannedAt?: number;
  createdAt: number;
}

const CollectionRowZ = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["movie", "tv", "local"]),
  created_at: z.coerce.number(),
  updated_at: z.coerce.number(),
});

const FolderRowZ = z.object({
  id: z.string(),
  collection_id: z.string(),
  path: z.string(),
  name: z.string(),
  created_at: z.coerce.number(),
  last_scanned_at: z.number().nullable(),
});

export type ItemKind = "title" | "local";
export interface CollectionRepository {
  listCollections(): CollectionRow[];
  findCollection(id: string): CollectionRow | null;
  nameTaken(name: string): string | null;
  insertCollection(id: string, name: string, type: CollectionType, at: number): void;
  updateCollection(id: string, patch: { name?: string; type?: CollectionType }, at: number): void;
  deleteCollection(id: string): void;

  addMember(collectionId: string, kind: ItemKind, itemId: string, at: number): void;
  removeMember(collectionId: string, kind: ItemKind, itemId: string): void;
  collectionsOfItem(kind: ItemKind, itemId: string): string[];
  itemCount(collectionId: string): number;

  listFolders(collectionId: string): FolderRow[];
  findFolder(folderId: string): FolderRow | null;
  addFolder(id: string, collectionId: string, path: string, name: string, at: number): void;
  setFolderLocation(folderId: string, path: string, name: string): void;
  setFolderScannedAt(folderId: string, at: number): void;
  deleteFolder(folderId: string): void;
  folderFileCount(folderId: string): number;
}

export function createCollectionRepository(db: Database): CollectionRepository {
  const listAll = db.prepare("SELECT id, name, type, created_at, updated_at FROM collections ORDER BY name COLLATE NOCASE");
  const selectOne = db.prepare("SELECT id, name, type, created_at, updated_at FROM collections WHERE id = ?");
  const byName = db.prepare("SELECT id FROM collections WHERE name = ? COLLATE NOCASE");
  const insertCollection = db.prepare(
    "INSERT INTO collections (id, name, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
  );
  const update = db.prepare("UPDATE collections SET name = COALESCE(?, name), type = COALESCE(?, type), updated_at = ? WHERE id = ?");
  const dropCollection = db.prepare("DELETE FROM collections WHERE id = ?");

  const addMember = db.prepare(
    "INSERT OR IGNORE INTO collection_items (id, collection_id, item_kind, item_id, added_at) VALUES (?, ?, ?, ?, ?)",
  );
  const dropMember = db.prepare("DELETE FROM collection_items WHERE collection_id = ? AND item_kind = ? AND item_id = ?");
  const memberships = db.prepare(
    `SELECT DISTINCT c.id FROM collections c
       LEFT JOIN collection_items i ON i.collection_id = c.id AND i.item_kind = ? AND i.item_id = ?
       LEFT JOIN local_files lf ON lf.collection_id = c.id AND ? = 'local' AND lf.id = ?
      WHERE i.id IS NOT NULL OR lf.id IS NOT NULL
      ORDER BY c.name COLLATE NOCASE`,
  );
  const countItems = db.prepare("SELECT COUNT(*) AS n FROM collection_items WHERE collection_id = ?");
  const countFiles = db.prepare("SELECT COUNT(*) AS n FROM local_files WHERE collection_id = ?");
  const countFolderFiles = db.prepare("SELECT COUNT(*) AS n FROM local_files WHERE folder_id = ?");

  const listFolderRows = db.prepare(
    "SELECT id, collection_id, path, name, created_at, last_scanned_at FROM collection_folders WHERE collection_id = ? ORDER BY created_at, rowid",
  );
  const selectFolder = db.prepare(
    "SELECT id, collection_id, path, name, created_at, last_scanned_at FROM collection_folders WHERE id = ?",
  );
  const insertFolder = db.prepare(
    "INSERT INTO collection_folders (id, collection_id, path, name, created_at) VALUES (?, ?, ?, ?, ?)",
  );
  const moveFolder = db.prepare("UPDATE collection_folders SET path = ?, name = ? WHERE id = ?");
  const markScanned = db.prepare("UPDATE collection_folders SET last_scanned_at = ? WHERE id = ?");
  const dropFolder = db.prepare("DELETE FROM collection_folders WHERE id = ?");

  const collectionRow = (raw: unknown): CollectionRow | null => {
    const row = CollectionRowZ.safeParse(raw);
    return row.success
      ? { id: row.data.id, name: row.data.name, type: row.data.type, createdAt: row.data.created_at, updatedAt: row.data.updated_at }
      : null;
  };

  const folderRow = (raw: unknown): FolderRow | null => {
    const row = FolderRowZ.safeParse(raw);
    if (!row.success) return null;
    return {
      id: row.data.id,
      collectionId: row.data.collection_id,
      path: row.data.path,
      name: row.data.name,
      createdAt: row.data.created_at,
      ...(row.data.last_scanned_at !== null && { lastScannedAt: row.data.last_scanned_at }),
    };
  };

  return {
    listCollections() {
      return listAll.all().reduce<CollectionRow[]>((rows, raw) => {
        const row = collectionRow(raw);
        if (row) rows.push(row);
        return rows;
      }, []);
    },
    findCollection(id) {
      return collectionRow(selectOne.get(id));
    },
    nameTaken(name) {
      const row = byName.get(name) as { id?: string } | undefined;
      return row?.id ?? null;
    },
    insertCollection(id, name, type, at) {
      insertCollection.run(id, name, type, at, at);
    },
    updateCollection(id, patch, at) {
      update.run(patch.name ?? null, patch.type ?? null, at, id);
    },
    deleteCollection(id) {
      dropCollection.run(id);
    },

    addMember(collectionId, kind, itemId, at) {
      addMember.run(`${collectionId}:${kind}:${itemId}`, collectionId, kind, itemId, at);
    },
    removeMember(collectionId, kind, itemId) {
      dropMember.run(collectionId, kind, itemId);
    },
    collectionsOfItem(kind, itemId) {
      const ids: string[] = [];
      for (const raw of memberships.all(kind, itemId, kind, itemId)) {
        const row = z.object({ id: z.string() }).safeParse(raw);
        if (row.success) ids.push(row.data.id);
      }
      return ids;
    },
    itemCount(collectionId) {
      const manual = Number((countItems.get(collectionId) as { n: number }).n);
      const files = Number((countFiles.get(collectionId) as { n: number }).n);
      return manual + files;
    },

    listFolders(collectionId) {
      return listFolderRows.all(collectionId).reduce<FolderRow[]>((rows, raw) => {
        const row = folderRow(raw);
        if (row) rows.push(row);
        return rows;
      }, []);
    },
    findFolder(folderId) {
      return folderRow(selectFolder.get(folderId));
    },
    addFolder(id, collectionId, path, name, at) {
      insertFolder.run(id, collectionId, path, name, at);
    },
    setFolderLocation(folderId, path, name) {
      moveFolder.run(path, name, folderId);
    },
    setFolderScannedAt(folderId, at) {
      markScanned.run(at, folderId);
    },
    deleteFolder(folderId) {
      dropFolder.run(folderId);
    },
    folderFileCount(folderId) {
      return Number((countFolderFiles.get(folderId) as { n: number }).n);
    },
  };
}
