import { z } from "zod";

import type { Database } from "./database.js";
import type { ProviderFamily, ProviderMessageShape } from "../types/provider.js";
import type { BackendProvider } from "../types/provider.js";

const ProviderRow = z.object({
  id: z.number(),
  name: z.string(),
  source: z.string(),
  is_active: z.number(),
  created_at: z.string(),
  order: z.number(),
  family: z.string(),
  movie_template: z.string().nullable(),
  episode_template: z.string().nullable(),
  start_param: z.string().nullable(),
  subtitles_param: z.string().nullable(),
  origin: z.string().nullable(),
  frame_origins: z.string().nullable(),
  message_shape: z.string().nullable(),
});

/** Only the two enum values the row may hold; anything else reads as the default. */
const familyOf = (value: string): ProviderFamily => (value === "stream" ? "stream" : "embed");

const shapeOf = (value: string | null): ProviderMessageShape | undefined =>
  value === "vidsrc-status" || value === "player-event" ? value : undefined;

/** A hand-edited or damaged JSON list reads as absent, never breaks a read. */
const frameOriginsOf = (json: string | null): string[] | undefined => {
  if (json === null) return undefined;
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return undefined;
    const origins = parsed.filter((o): o is string => typeof o === "string");
    return origins.length > 0 ? origins : undefined;
  } catch {
    return undefined;
  }
};

function toProvider(row: unknown): BackendProvider {
  const r = ProviderRow.parse(row);
  return {
    id: r.id,
    name: r.name,
    source: r.source,
    is_active: r.is_active === 1,
    order: r.order,
    family: familyOf(r.family),
    movieTemplate: r.movie_template ?? undefined,
    episodeTemplate: r.episode_template ?? undefined,
    startParam: r.start_param ?? undefined,
    subtitlesParam: r.subtitles_param ?? undefined,
    origin: r.origin ?? undefined,
    frameOrigins: frameOriginsOf(r.frame_origins),
    messageShape: shapeOf(r.message_shape),
    created_at: r.created_at,
  };
}

/** What a row holds, written whole on create and on every change. */
export interface ProviderRecord {
  id: number;
  name: string;
  source: string;
  is_active: number;
  created_at: string;
  order: number;
  family: ProviderFamily;
  movie_template: string | null;
  episode_template: string | null;
  start_param: string | null;
  subtitles_param: string | null;
  origin: string | null;
  frame_origins: string | null;
  message_shape: string | null;
}

const COLUMNS = `
  id, name, source, is_active, created_at, "order", family, movie_template, episode_template,
  start_param, subtitles_param, origin, frame_origins, message_shape`;

const SQL = {
  all: `SELECT ${COLUMNS} FROM providers ORDER BY "order", id`,
  one: `SELECT ${COLUMNS} FROM providers WHERE id = ?`,
  insert: `
    INSERT INTO providers (
      name, source, is_active, created_at, "order", family, movie_template, episode_template,
      start_param, subtitles_param, origin, frame_origins, message_shape
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  update: `
    UPDATE providers SET
      name = ?, source = ?, is_active = ?, "order" = ?, family = ?, movie_template = ?,
      episode_template = ?, start_param = ?, subtitles_param = ?, origin = ?, frame_origins = ?,
      message_shape = ?
    WHERE id = ?`,
  remove: "DELETE FROM providers WHERE id = ?",
};

/**
 * The providers table (docs/03 section 7.2b). Ordered by preference order then id, the order the
 * sources fill answers in (docs/03 section 7.5).
 */
export function createProviderRepository(db: Database) {
  return {
    list: async (): Promise<BackendProvider[]> => (await db.execute(SQL.all)).rows.map(toProvider),
    find: async (id: number): Promise<BackendProvider | undefined> => {
      const row = (await db.execute({ sql: SQL.one, args: [id] })).rows[0];
      return row === undefined ? undefined : toProvider(row);
    },
    isEmpty: async (): Promise<boolean> => (await db.execute(SQL.all)).rows.length === 0,
    async insert(c: Omit<ProviderRecord, "id">): Promise<number> {
      const result = await db.execute({
        sql: SQL.insert,
        args: [
          c.name, c.source, c.is_active, c.created_at, c.order, c.family, c.movie_template,
          c.episode_template, c.start_param, c.subtitles_param, c.origin, c.frame_origins, c.message_shape,
        ],
      });
      return Number(result.lastInsertRowid);
    },
    update: async (c: ProviderRecord): Promise<boolean> => {
      const result = await db.execute({
        sql: SQL.update,
        args: [
          c.name, c.source, c.is_active, c.order, c.family, c.movie_template, c.episode_template,
          c.start_param, c.subtitles_param, c.origin, c.frame_origins, c.message_shape, c.id,
        ],
      });
      return result.rowsAffected > 0;
    },
    remove: async (id: number): Promise<boolean> =>
      (await db.execute({ sql: SQL.remove, args: [id] })).rowsAffected > 0,
  };
}

export type ProviderRepository = ReturnType<typeof createProviderRepository>;
