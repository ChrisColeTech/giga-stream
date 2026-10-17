import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";

import type { ProviderFamily, ProviderMessageShape } from "../types/provider.js";
import type { BackendProvider } from "../types/provider.js";

const ProviderRow = z.object({
  id: z.number(),
  name: z.string(),
  source: z.string(),
  api_key: z.string().nullable(),
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
    api_key: r.api_key ?? "",
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
  api_key: string | null;
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
  id, name, source, api_key, is_active, created_at, "order", family, movie_template, episode_template,
  start_param, subtitles_param, origin, frame_origins, message_shape`;

/**
 * The providers table (docs/03 section 7.2b). Ordered by preference order then id, the order the
 * sources fill answers in (docs/03 section 7.5).
 */
export function createProviderRepository(db: DatabaseSync) {
  const all = db.prepare(`SELECT ${COLUMNS} FROM providers ORDER BY "order", id`);
  const one = db.prepare(`SELECT ${COLUMNS} FROM providers WHERE id = ?`);
  const insert = db.prepare(`
    INSERT INTO providers (
      name, source, api_key, is_active, created_at, "order", family, movie_template, episode_template,
      start_param, subtitles_param, origin, frame_origins, message_shape
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const update = db.prepare(`
    UPDATE providers SET
      name = ?, source = ?, api_key = ?, is_active = ?, "order" = ?, family = ?, movie_template = ?,
      episode_template = ?, start_param = ?, subtitles_param = ?, origin = ?, frame_origins = ?,
      message_shape = ?
    WHERE id = ?`);
  const remove = db.prepare("DELETE FROM providers WHERE id = ?");

  return {
    list: (): BackendProvider[] => all.all().map(toProvider),
    find(id: number): BackendProvider | undefined {
      const row = one.get(id);
      return row === undefined ? undefined : toProvider(row);
    },
    isEmpty: (): boolean => all.all().length === 0,
    insert(c: Omit<ProviderRecord, "id">): number {
      const result = insert.run(
        c.name, c.source, c.api_key, c.is_active, c.created_at, c.order, c.family, c.movie_template,
        c.episode_template, c.start_param, c.subtitles_param, c.origin, c.frame_origins, c.message_shape,
      );
      return Number(result.lastInsertRowid);
    },
    update(c: ProviderRecord): boolean {
      const result = update.run(
        c.name, c.source, c.api_key, c.is_active, c.order, c.family, c.movie_template, c.episode_template,
        c.start_param, c.subtitles_param, c.origin, c.frame_origins, c.message_shape, c.id,
      );
      return Number(result.changes) > 0;
    },
    remove(id: number): boolean {
      return Number(remove.run(id).changes) > 0;
    },
  };
}

export type ProviderRepository = ReturnType<typeof createProviderRepository>;
