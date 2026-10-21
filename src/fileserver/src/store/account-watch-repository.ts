import { z } from "zod";

import type { AdminDatabase } from "./admin-database.js";

const Row = z.object({
  id: z.string(), item_kind: z.enum(["title", "local"]), item_id: z.string(),
  season: z.coerce.number().int().nullable(), episode: z.coerce.number().int().nullable(),
  position_ms: z.coerce.number().int(), duration_ms: z.coerce.number().int().nullable(),
  state: z.enum(["watching", "watched"]), updated_at: z.coerce.number().int(),
  playback_id: z.string(), seq: z.coerce.number().int(),
});

export interface AccountWatchRow {
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

const COLUMNS = `id, item_kind, item_id, season, episode, position_ms, duration_ms, state,
  updated_at, playback_id, seq`;
const view = (raw: unknown): AccountWatchRow => {
  const row = Row.parse(raw);
  return {
    id: row.id, itemKind: row.item_kind, itemId: row.item_id,
    ...(row.season !== null && { season: row.season }), ...(row.episode !== null && { episode: row.episode }),
    positionMs: row.position_ms, ...(row.duration_ms !== null && { durationMs: row.duration_ms }),
    state: row.state, updatedAt: row.updated_at, playbackId: row.playback_id, seq: row.seq,
  };
};

export function createAccountWatchRepository(database: AdminDatabase) {
  async function findIdentity(
    accountId: string,
    input: { kind: string; itemId: string; season?: number; episode?: number },
  ): Promise<AccountWatchRow | undefined> {
    const raw = (await database.execute({
      sql: `SELECT ${COLUMNS} FROM user_watch WHERE account_id = ? AND item_kind = ? AND item_id = ?
        AND COALESCE(season, 0) = ? AND COALESCE(episode, 0) = ?`,
      args: [accountId, input.kind, input.itemId, input.season ?? 0, input.episode ?? 0],
    })).rows[0];
    return raw === undefined ? undefined : view(raw);
  }
  return {
    findIdentity,
    async list(accountId: string): Promise<AccountWatchRow[]> {
      const result = await database.execute({
        sql: `SELECT ${COLUMNS} FROM user_watch WHERE account_id = ? ORDER BY updated_at DESC, rowid DESC`,
        args: [accountId],
      });
      return result.rows.map(view);
    },
    async upsert(accountId: string, input: AccountWatchRow): Promise<AccountWatchRow> {
      const existing = await findIdentity(accountId, {
        kind: input.itemKind, itemId: input.itemId, season: input.season, episode: input.episode,
      });
      if (existing === undefined) {
        await database.execute({
          sql: `INSERT INTO user_watch (id, account_id, item_kind, item_id, season, episode, position_ms,
            duration_ms, state, updated_at, playback_id, seq) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [input.id, accountId, input.itemKind, input.itemId, input.season ?? null, input.episode ?? null,
            input.positionMs, input.durationMs ?? null, input.state, input.updatedAt, input.playbackId, input.seq],
        });
        return input;
      }
      await database.execute({
        sql: `UPDATE user_watch SET position_ms = ?, duration_ms = COALESCE(?, duration_ms), state = ?,
          updated_at = ?, playback_id = ?, seq = ? WHERE account_id = ? AND id = ?`,
        args: [input.positionMs, input.durationMs ?? null, input.state, input.updatedAt,
          input.playbackId, input.seq, accountId, existing.id],
      });
      return { ...input, id: existing.id, durationMs: input.durationMs ?? existing.durationMs };
    },
    async remove(accountId: string, id: string): Promise<boolean> {
      const result = await database.execute({
        sql: "DELETE FROM user_watch WHERE account_id = ? AND id = ?", args: [accountId, id],
      });
      return result.rowsAffected > 0;
    },
    async clear(accountId: string): Promise<number> {
      return (await database.execute({ sql: "DELETE FROM user_watch WHERE account_id = ?", args: [accountId] }))
        .rowsAffected;
    },
  };
}

export type AccountWatchRepository = ReturnType<typeof createAccountWatchRepository>;
