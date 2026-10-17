import { randomUUID } from "node:crypto";

import type { Collection, CollectionMembership, CollectionType, Folder, ItemRef } from "../types/collection.js";
import { AppError } from "../lib/app-error.js";
import type { CollectionRepository, FolderRow } from "../store/collection-repository.js";
import type { FsDialogService } from "./fs-dialog-service.js";
import type { ScanService } from "./scan-service.js";

const invalid = (): AppError => new AppError("collection.invalid", 422, "That name cannot be used.");

const notFound = (): AppError => new AppError("collection.not_found", 404, "There is no such collection.");

/** A trimmed name of 1..80 characters (docs/03 section 3.7). */
export function readName(name: unknown): string {
  if (typeof name !== "string") throw invalid();
  const trimmed = name.trim();
  if (trimmed === "" || trimmed.length > 80) throw invalid();
  return trimmed;
}

const kinds = new Set(["title", "local"]);
const collectionTypes = new Set<unknown>(["movie", "tv", "local"]);

function readType(type: unknown): CollectionType {
  if (!collectionTypes.has(type)) throw invalid();
  return type as CollectionType;
}

function readKind(kind: string): ItemRef["kind"] {
  if (!kinds.has(kind)) throw invalid();
  return kind as ItemRef["kind"];
}

export interface CollectionService {
  create: (name: unknown, type: unknown) => Collection;
  list: () => Collection[];
  update: (collectionId: string, patch: { name?: unknown; type?: unknown }) => Collection;
  /** Removes it and its folders' records; disk is never touched; answers what the route tells (3.7). */
  remove: (collectionId: string) => { removed: string };
  addItem: (collectionId: string, kind: string, itemId: string) => Collection;
  removeItem: (collectionId: string, kind: string, itemId: string) => Collection;
  /** `GET /api/items/:kind/:itemId/collections` — manual or through a folder (3.7). */
  itemCollections: (kind: string, itemId: string) => { memberships: CollectionMembership[] };
  /** `{ token }` of `POST /api/fs/dialog`; attaches the folder and queues its scan (3.8). */
  attachFolder: (collectionId: string, token: unknown) => Promise<Folder>;
  /** `{ token }` of `PUT /api/folders/:folderId`: new location, then a fresh scan (3.8). */
  setFolderLocation: (folderId: string, token: unknown) => Promise<Folder>;
  /** Queues the folder's scan; the answer's `scanning` covers a queued scan too (3.8). */
  rescan: (folderId: string) => Folder;
  /** Detaches it and removes its file records; disk is never touched (3.8). */
  detachFolder: (folderId: string) => { removed: string };
  /** One folder as its DTO, or `404 collection.not_found`. */
  folder: (folderId: string) => Folder;
}

export function createCollectionService(deps: {
  collections: CollectionRepository;
  scans: ScanService;
  dialog: FsDialogService;
  now: () => number;
}): CollectionService {
  const { collections, scans, dialog, now } = deps;

  const folderOf = (row: FolderRow): Folder => ({
    id: row.id,
    collectionId: row.collectionId,
    name: row.name,
    fileCount: collections.folderFileCount(row.id),
    scanning: scans.scanning(row.id),
    ...(row.lastScannedAt !== undefined && { lastScannedAt: row.lastScannedAt }),
  });

  const collectionOf = (id: string): Collection => {
    const row = collections.findCollection(id);
    if (row === null) throw notFound();
    const folders = collections.listFolders(id).map(folderOf);
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      itemCount: collections.itemCount(id),
      folders,
      scanning: folders.some((folder) => folder.scanning),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  };

  const requireFolder = (folderId: string): FolderRow => {
    const row = collections.findFolder(folderId);
    if (row === null) throw notFound();
    return row;
  };

  return {
    create(name, type) {
      const ready = readName(name);
      if (collections.nameTaken(ready) !== null) throw invalid();
      const id = randomUUID();
      collections.insertCollection(id, ready, readType(type), now());
      return collectionOf(id);
    },

    list: () => collections.listCollections().map((row) => collectionOf(row.id)),

    update(collectionId, patch) {
      collectionOf(collectionId);
      if (patch.name === undefined && patch.type === undefined) throw invalid();
      const name = patch.name === undefined ? undefined : readName(patch.name);
      const type = patch.type === undefined ? undefined : readType(patch.type);
      const other = name === undefined ? null : collections.nameTaken(name);
      if (other !== null && other !== collectionId) throw invalid();
      collections.updateCollection(collectionId, { ...(name !== undefined && { name }), ...(type !== undefined && { type }) }, now());
      return collectionOf(collectionId);
    },

    remove(collectionId) {
      collectionOf(collectionId);
      for (const folder of collections.listFolders(collectionId)) {
        scans.cancel(folder.id);
        scans.discard(folder.id);
      }
      collections.deleteCollection(collectionId);
      return { removed: collectionId };
    },

    addItem(collectionId, kind, itemId) {
      collectionOf(collectionId);
      collections.addMember(collectionId, readKind(kind), itemId, now());
      return collectionOf(collectionId);
    },

    removeItem(collectionId, kind, itemId) {
      collectionOf(collectionId);
      collections.removeMember(collectionId, readKind(kind), itemId);
      return collectionOf(collectionId);
    },

    itemCollections(kind, itemId) {
      return { memberships: collections.collectionsOfItem(readKind(kind), itemId) };
    },

    async attachFolder(collectionId, token) {
      collectionOf(collectionId);
      const location = await dialogPath(dialog, token);
      const id = randomUUID();
      collections.addFolder(id, collectionId, location, baseName(location), now());
      scans.queueScan(id);
      return folderOf(requireFolder(id));
    },

    async setFolderLocation(folderId, token) {
      requireFolder(folderId);
      const location = await dialogPath(dialog, token);
      collections.setFolderLocation(folderId, location, baseName(location));
      scans.queueScan(folderId);
      return folderOf(requireFolder(folderId));
    },

    rescan(folderId) {
      requireFolder(folderId);
      scans.queueScan(folderId);
      return folderOf(requireFolder(folderId));
    },

    detachFolder(folderId) {
      requireFolder(folderId);
      scans.cancel(folderId);
      scans.discard(folderId);
      collections.deleteFolder(folderId);
      return { removed: folderId };
    },

    folder: (folderId) => folderOf(requireFolder(folderId)),
  };
}

async function dialogPath(dialog: FsDialogService, token: unknown): Promise<string> {
  if (typeof token !== "string" || token === "") {
    throw new AppError("fs.invalid_selection", 422, "That selection cannot be used.");
  }
  // The token's folder passed the existence check at selection; a moved one is refused now.
  try {
    return await dialog.redeem(token);
  } catch (error) {
    throw error instanceof AppError ? error : new AppError("fs.invalid_selection", 422, "That selection cannot be used.");
  }
}

function baseName(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts.at(-1) ?? "Folder";
}
