import { z } from "zod";

import type { Database } from "./database.js";

/**
 * A user_watch row (032): the identity is the item with its exact episode, unique per account. The
 * caller always names the account, so the row itself does not repeat it.
 */
export interface StoredWatch {
  id: string;
  itemKind: "title" | "local";
  itemId: string;
  season?: number;
  episode?: number;
  positionMs: number;
  durationMs?: number;
  state: "watching" | "watched";
  updatedAt: number;
  playbackId: string;
  seq: number;
}

/** An item's identity within one account: the kind, the id and the exact episode, either part optional. */
export interface WatchIdentity {
  kind: "title" | "local";
  itemId: string;
  season?: number;
  episode?: number;
}

const WatchRow = z.object({
  id: z.string(),
  item_kind: z.enum(["title", "local"]),
  item_id: z.string(),
  season: z.number().nullable(),
  episode: z.number().nullable(),
  position_ms: z.coerce.number(),
  duration_ms: z.coerce.number().nullable(),
  state: z.enum(["watching", "watched"]),
  updated_at: z.coerce.number(),
  playback_id: z.string(),
  seq: z.coerce.number(),
});

const COLUMNS =
  "id, item_kind, item_id, season, episode, position_ms, duration_ms, state, updated_at, playback_id, seq";

const SQL = {
  all: `SELECT ${COLUMNS} FROM user_watch WHERE account_id = ? ORDER BY updated_at DESC, rowid DESC`,
  one: `SELECT ${COLUMNS} FROM user_watch WHERE account_id = ? AND id = ?`,
  // The identity key as the unique index (032) holds it: an absent season or episode is the 0 sentinel,
  // which a real write (a positive episode number only) can never carry.
  identity: `SELECT ${COLUMNS} FROM user_watch
    WHERE account_id = ? AND item_kind = ? AND item_id = ? AND COALESCE(season, 0) = ? AND COALESCE(episode, 0) = ?`,
  insert: `
    INSERT INTO user_watch (id, account_id, item_kind, item_id, season, episode, position_ms, duration_ms,
        state, updated_at, playback_id, seq)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  update: `
    UPDATE user_watch SET position_ms = ?, duration_ms = COALESCE(?, duration_ms), state = ?, updated_at = ?,
        playback_id = ?, seq = ?
    WHERE id = ?`,
  remove: "DELETE FROM user_watch WHERE account_id = ? AND id = ?",
  clear: "DELETE FROM user_watch WHERE account_id = ?",
};

function toRow(raw: unknown): StoredWatch | null {
  const row = WatchRow.safeParse(raw);
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
    playbackId: row.data.playback_id,
    seq: row.data.seq,
  };
}

export interface WatchUpsert {
  id: string;
  kind: "title" | "local";
  itemId: string;
  season?: number;
  episode?: number;
  positionMs: number;
  durationMs?: number;
  state: "watching" | "watched";
  at: number;
  playbackId: string;
  seq: number;
}

/**
 * The account's watch history (docs/63 section 3.2): the fileserver's watch_entries verbs, every query
 * scoped to its account, so no route can reach another account's rows. The unique identity index makes a
 * re-write of the same episode the same row; an update keeps a duration the write does not carry.
 */
export function createUserWatchRepository(db: Database) {
  async function findByIdentity(accountId: string, identity: WatchIdentity): Promise<StoredWatch | null> {
    const rows = await db.execute({
      sql: SQL.identity,
      args: [accountId, identity.kind, identity.itemId, identity.season ?? 0, identity.episode ?? 0],
    });
    return toRow(rows.rows[0]);
  }

  async function find(accountId: string, id: string): Promise<StoredWatch | null> {
    return toRow((await db.execute({ sql: SQL.one, args: [accountId, id] })).rows[0]);
  }

  return {
    /** The account's entries, most recently updated first, ties broken by insertion (the shared order). */
    list: async (accountId: string): Promise<StoredWatch[]> =>
      (await db.execute({ sql: SQL.all, args: [accountId] })).rows.map((row) => toRow(row) as StoredWatch),
    find,
    findByIdentity,
    /** Upsert by the unique identity (032): answers the row as it now stands. */
    upsert: async (accountId: string, input: WatchUpsert): Promise<StoredWatch> => {
      const existing = await findByIdentity(accountId, input);
      const id = existing?.id ?? input.id;
      if (existing === null) {
        await db.execute({
          sql: SQL.insert,
          args: [
            input.id, accountId, input.kind, input.itemId, input.season ?? null, input.episode ?? null,
            input.positionMs, input.durationMs ?? null, input.state, input.at, input.playbackId, input.seq,
          ],
        });
      } else {
        await db.execute({
          sql: SQL.update,
          args: [
            input.positionMs, input.durationMs ?? null, input.state, input.at, input.playbackId, input.seq,
            existing.id,
          ],
        });
      }
      // The row was found or made one statement ago; it cannot be absent.
      return (await find(accountId, id)) as StoredWatch;
    },
    remove: async (accountId: string, id: string): Promise<boolean> =>
      (await db.execute({ sql: SQL.remove, args: [accountId, id] })).rowsAffected > 0,
    /** The whole history and only the history: favorites, collections and settings are untouched (03 3.13). */
    clearAll: async (accountId: string): Promise<number> =>
      (await db.execute({ sql: SQL.clear, args: [accountId] })).rowsAffected,
  };
}

export type UserWatchRepository = ReturnType<typeof createUserWatchRepository>;
