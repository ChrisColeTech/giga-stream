import { z } from "zod";

import type { ItemKind } from "./collection-repository.js";
import type { Database } from "./database.js";

/** A watch entry as the library lists it (docs/03 section 3.5: history is the watch entries). */
export interface LibraryWatchRow {
  id: string;
  itemKind: ItemKind;
  itemId: string;
  season?: number;
  episode?: number;
  positionMs: number;
  durationMs?: number;
  state: "watching" | "watched";
  updatedAt: number;
}

/** A found file as a library card needs it (docs/03 section 3.5); `path` never crosses into it. */
export interface LibraryFileRow {
  id: string;
  title: string;
  addedAt: number;
  posterId?: string;
  height?: number;
}

/** One favorited item, or one collection member, by kind and id. */
export interface LibraryMemberRow {
  kind: ItemKind;
  itemId: string;
}

const WatchRowZ = z.object({
  id: z.string(),
  item_kind: z.enum(["title", "local"]),
  item_id: z.string(),
  season: z.number().nullable(),
  episode: z.number().nullable(),
  position_ms: z.coerce.number(),
  duration_ms: z.coerce.number().nullable(),
  state: z.enum(["watching", "watched"]),
  updated_at: z.coerce.number(),
});
const FileRowZ = z.object({
  id: z.string(),
  title: z.string(),
  added_at: z.coerce.number(),
  poster_id: z.string().nullable(),
  height: z.coerce.number().nullable(),
});
const MemberRowZ = z.object({ item_kind: z.enum(["title", "local"]), item_id: z.string() });

export interface LibraryRepository {
  /** Every watch entry, newest first (03 section 3.5). */
  listWatchEntries(): LibraryWatchRow[];
  /** The item's newest entry, whatever episode it is; null when there is none. */
  newestWatchEntry(kind: ItemKind, itemId: string): LibraryWatchRow | null;
  /** Every favorited item (03 section 3.12). */
  listFavorites(): LibraryMemberRow[];
  /** Every found file, the local part of `view=all` (03 section 3.5). */
  listLocalFiles(): LibraryFileRow[];
  /** The files of one collection's folders (03 section 3.5). */
  listCollectionFiles(collectionId: string): LibraryFileRow[];
  /** One collection's manual members (03 section 3.7). */
  listCollectionMembers(collectionId: string): LibraryMemberRow[];
}

/** The library query's own list reads (docs/03 section 3.5); SQL lives here and nowhere else. */
export function createLibraryRepository(db: Database): LibraryRepository {
  const watchColumns = "id, item_kind, item_id, season, episode, position_ms, duration_ms, state, updated_at";
  const selectWatchAll = db.prepare(`SELECT ${watchColumns} FROM watch_entries ORDER BY updated_at DESC, rowid DESC`);
  const selectWatchNewest = db.prepare(
    `SELECT ${watchColumns} FROM watch_entries WHERE item_kind = ? AND item_id = ? ORDER BY updated_at DESC, rowid DESC LIMIT 1`,
  );
  const selectFavorites = db.prepare("SELECT item_kind, item_id FROM favorites ORDER BY added_at DESC, rowid DESC");
  const fileColumns = "id, title, added_at, poster_id, height";
  const selectFilesAll = db.prepare(`SELECT ${fileColumns} FROM local_files ORDER BY added_at DESC, rowid DESC`);
  const selectFilesOfCollection = db.prepare(
    `SELECT ${fileColumns} FROM local_files WHERE collection_id = ? ORDER BY added_at DESC, rowid DESC`,
  );
  const selectMembers = db.prepare(
    "SELECT item_kind, item_id FROM collection_items WHERE collection_id = ? ORDER BY added_at DESC, rowid DESC",
  );

  const watchRow = (raw: unknown): LibraryWatchRow | null => {
    const row = WatchRowZ.safeParse(raw);
    if (!row.success) return null;
    return {
      id: row.data.id,
      itemKind: row.data.item_kind,
      itemId: row.data.item_id,
      ...(row.data.season !== null && { season: row.data.season }),
      ...(row.data.episode !== null && { episode: row.data.episode }),
      positionMs: row.data.position_ms,
      ...(row.data.duration_ms !== null && { durationMs: row.data.duration_ms }),
      state: row.data.state,
      updatedAt: row.data.updated_at,
    };
  };

  const fileRow = (raw: unknown): LibraryFileRow | null => {
    const row = FileRowZ.safeParse(raw);
    if (!row.success) return null;
    return {
      id: row.data.id,
      title: row.data.title,
      addedAt: row.data.added_at,
      ...(row.data.poster_id !== null && { posterId: row.data.poster_id }),
      ...(row.data.height !== null && { height: row.data.height }),
    };
  };

  const memberRow = (raw: unknown): LibraryMemberRow | null => {
    const row = MemberRowZ.safeParse(raw);
    return row.success ? { kind: row.data.item_kind, itemId: row.data.item_id } : null;
  };

  const rowsOf = <T>(raws: unknown[], read: (raw: unknown) => T | null): T[] =>
    raws.reduce<T[]>((rows, raw) => {
      const row = read(raw);
      if (row !== null) rows.push(row);
      return rows;
    }, []);

  return {
    listWatchEntries() {
      return rowsOf(selectWatchAll.all(), watchRow);
    },
    newestWatchEntry(kind, itemId) {
      return watchRow(selectWatchNewest.get(kind, itemId));
    },
    listFavorites() {
      return rowsOf(selectFavorites.all(), memberRow);
    },
    listLocalFiles() {
      return rowsOf(selectFilesAll.all(), fileRow);
    },
    listCollectionFiles(collectionId) {
      return rowsOf(selectFilesOfCollection.all(collectionId), fileRow);
    },
    listCollectionMembers(collectionId) {
      return rowsOf(selectMembers.all(collectionId), memberRow);
    },
  };
}
