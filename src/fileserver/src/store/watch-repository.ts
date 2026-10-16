import { z } from "zod";

import type { ItemKind } from "./collection-repository.js";
import type { Database } from "./database.js";

/** A watch_entries row (001): the identity is the item with its exact episode (unique index). */
export interface WatchRow {
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

const RowSchema = z.object({
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

export interface WatchRepository {
  findByIdentity(input: { kind: ItemKind; itemId: string; season?: number; episode?: number }): WatchRow | null;
  find(id: string): WatchRow | null;
  /** Upsert by the table's unique identity (the COALESCE index, 001). Answers the row as it stands. */
  upsert(input: { id: string; kind: ItemKind; itemId: string; season?: number; episode?: number; positionMs: number; durationMs?: number; state: "watching" | "watched"; at: number }): WatchRow;
  /** The same UPSERT's write path without changing `watched` back. */
  remove(id: string): boolean;
  clearAll(): number;
}

export function createWatchRepository(db: Database): WatchRepository {
  const columns = "id, item_kind, item_id, season, episode, position_ms, duration_ms, state, updated_at";
  const selectIdentity = db.prepare(
    `SELECT ${columns} FROM watch_entries
      WHERE item_kind = ? AND item_id = ? AND COALESCE(season, -1) = ? AND COALESCE(episode, -1) = ?`,
  );
  const selectOne = db.prepare(`SELECT ${columns} FROM watch_entries WHERE id = ?`);
  const insert = db.prepare(
    `INSERT INTO watch_entries (id, item_kind, item_id, season, episode, position_ms, duration_ms, state, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const update = db.prepare(
    "UPDATE watch_entries SET position_ms = ?, duration_ms = COALESCE(?, duration_ms), state = ?, updated_at = ? WHERE id = ?",
  );
  const dropOne = db.prepare("DELETE FROM watch_entries WHERE id = ?");
  const dropAll = db.prepare("DELETE FROM watch_entries");

  function toRow(raw: unknown): WatchRow | null {
    const row = RowSchema.safeParse(raw);
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
  }

  return {
    findByIdentity({ kind, itemId, season, episode }) {
      const seasonKey = season ?? -1;
      const episodeKey = episode ?? -1;
      return toRow(selectIdentity.get(kind, itemId, seasonKey, episodeKey));
    },

    find(id) {
      return toRow(selectOne.get(id));
    },

    upsert(input) {
      const existing = this.findByIdentity(input);
      if (existing === null) {
        insert.run(
          input.id,
          input.kind,
          input.itemId,
          input.season ?? null,
          input.episode ?? null,
          input.positionMs,
          input.durationMs ?? null,
          input.state,
          input.at,
        );
        return toRow(selectOne.get(input.id)) as WatchRow;
      }
      update.run(input.positionMs, input.durationMs ?? null, input.state, input.at, existing.id);
      return toRow(selectOne.get(existing.id)) as WatchRow;
    },

    remove(id) {
      return Number(dropOne.run(id).changes) > 0;
    },

    clearAll() {
      return Number(dropAll.run().changes);
    },
  };
}
