import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";

import { applyFields } from "./title-edits.js";

/** A stored title: the `7.4` answer plus its freshness facts (docs/03 section 7.6b) and its record facts (docs/26 D20). */
export interface StoredTitle {
  id: string;
  kind: "movie" | "tv";
  /** A TMDB title always has one; a manual title only when the admin gave it. */
  tmdbId: number | null;
  origin: "tmdb" | "manual";
  /** The payload fields an admin edited; a sync merges TMDB's payload under them. */
  editedFields: string[];
  /** A disabled title stays in the admin's lists and is left out of the public reads; no sync changes it. */
  enabled: boolean;
  payload: unknown;
  popularityScore: number | null;
  popularityReadAt: number | null;
  fetchedAt: number;
}

/** What a sync or a fill-through writes: a TMDB title, keyed by kind and TMDB id. */
export interface TitleWrite {
  kind: "movie" | "tv";
  tmdbId: number;
  payload: unknown;
  popularityScore: number | null;
  popularityReadAt: number | null;
  fetchedAt: number;
}

const TitleRow = z.object({
  id: z.string(),
  kind: z.string(),
  tmdb_id: z.number().nullable(),
  origin: z.enum(["tmdb", "manual"]),
  edited_fields: z.string().nullable(),
  enabled: z.number().int(),
  payload: z.string(),
  popularity_score: z.number().nullable(),
  popularity_read_at: z.number().nullable(),
  fetched_at: z.number(),
});

const ListRow = z.object({
  ids: z.string(),
  total_pages: z.number(),
  total_results: z.number(),
  fetched_at: z.number(),
});

const editedOf = (json: string | null): string[] => {
  if (json === null) return [];
  const parsed = z.array(z.string()).safeParse(JSON.parse(json));
  return parsed.success ? parsed.data : [];
};

function stored(row: z.infer<typeof TitleRow>): StoredTitle {
  return {
    id: row.id,
    kind: row.kind === "tv" ? "tv" : "movie",
    tmdbId: row.tmdb_id,
    origin: row.origin,
    editedFields: editedOf(row.edited_fields),
    enabled: row.enabled === 1,
    payload: JSON.parse(row.payload) as unknown,
    popularityScore: row.popularity_score,
    popularityReadAt: row.popularity_read_at,
    fetchedAt: row.fetched_at,
  };
}

const COLUMNS =
  "id, kind, tmdb_id, origin, edited_fields, enabled, payload, popularity_score, popularity_read_at, fetched_at";

/**
 * The title store (docs/03 section 7.6b): `titles` and `title_lists`. A TMDB title is written whole on every sync or
 * fill-through, but `put` is the one place that decides what a write may change: it merges TMDB's payload under the
 * fields an admin edited and leaves `enabled` alone. Manual titles are never written by it.
 */
export function createTitleRepository(db: DatabaseSync) {
  const byTmdb = db.prepare(`SELECT ${COLUMNS} FROM titles WHERE kind = ? AND tmdb_id = ? AND origin = 'tmdb'`);
  const byId = db.prepare(`SELECT ${COLUMNS} FROM titles WHERE id = ?`);
  const manual = db.prepare(`SELECT ${COLUMNS} FROM titles WHERE origin = 'manual' ORDER BY fetched_at DESC, id`);
  const upsert = db.prepare(`
    INSERT INTO titles (id, kind, tmdb_id, origin, payload, popularity_score, popularity_read_at, fetched_at)
    VALUES (?, ?, ?, 'tmdb', ?, ?, ?, ?)
    ON CONFLICT (kind, tmdb_id) WHERE origin = 'tmdb' DO UPDATE SET
      payload = excluded.payload,
      popularity_score = COALESCE(excluded.popularity_score, titles.popularity_score),
      popularity_read_at = COALESCE(excluded.popularity_read_at, titles.popularity_read_at),
      fetched_at = excluded.fetched_at`);
  const insertManual = db.prepare(`
    INSERT INTO titles (id, kind, tmdb_id, origin, payload, fetched_at) VALUES (?, ?, ?, 'manual', ?, ?)`);
  const update = db.prepare("UPDATE titles SET payload = ?, edited_fields = ?, tmdb_id = ?, enabled = ? WHERE id = ?");
  const clearEdits = db.prepare("UPDATE titles SET edited_fields = NULL WHERE id = ?");
  const remove = db.prepare("DELETE FROM titles WHERE id = ?");
  const oneList = db.prepare("SELECT ids, total_pages, total_results, fetched_at FROM title_lists WHERE key = ?");
  const upsertList = db.prepare(`
    INSERT INTO title_lists (key, ids, total_pages, total_results, fetched_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (key) DO UPDATE SET
      ids = excluded.ids, total_pages = excluded.total_pages,
      total_results = excluded.total_results, fetched_at = excluded.fetched_at`);
  const counts = db.prepare("SELECT COUNT(*) AS total, SUM(fetched_at < ?) AS stale FROM titles WHERE origin = 'tmdb'");

  function findById(id: string): StoredTitle | undefined {
    const row = byId.get(id);
    return row === undefined ? undefined : stored(TitleRow.parse(row));
  }

  return {
    /** The stored TMDB title, or undefined. */
    find(kind: "movie" | "tv", tmdbId: number): StoredTitle | undefined {
      const row = byTmdb.get(kind, tmdbId);
      return row === undefined ? undefined : stored(TitleRow.parse(row));
    },
    findById,
    /** Every title made by hand, newest first. */
    listManual: (): StoredTitle[] => manual.all().map((row) => stored(TitleRow.parse(row))),
    put(title: TitleWrite): void {
      const id = `${title.kind}-${title.tmdbId}`;
      const existing = findById(id);
      const payload = existing && existing.editedFields.length > 0
        ? applyFields(title.payload, existing.payload, existing.editedFields)
        : title.payload;
      upsert.run(id, title.kind, title.tmdbId, JSON.stringify(payload), title.popularityScore, title.popularityReadAt, title.fetchedAt);
    },
    insertManual(title: { id: string; kind: "movie" | "tv"; tmdbId: number | null; payload: unknown; at: number }): void {
      insertManual.run(title.id, title.kind, title.tmdbId, JSON.stringify(title.payload), title.at);
    },
    /** An admin's edit: the new payload, the fields now edited (none for a manual title), a manual title's TMDB id, `enabled`. */
    updateRecord(id: string, change: { payload: unknown; editedFields: string[]; tmdbId: number | null; enabled: boolean }): void {
      const edited = change.editedFields.length > 0 ? JSON.stringify(change.editedFields) : null;
      update.run(JSON.stringify(change.payload), edited, change.tmdbId, change.enabled ? 1 : 0, id);
    },
    clearEdits(id: string): void {
      clearEdits.run(id);
    },
    remove(id: string): boolean {
      return Number(remove.run(id).changes) > 0;
    },
    /** A stored list answer: its title ids in order, or undefined. */
    findList(key: string): { ids: number[]; totalPages: number; totalResults: number; fetchedAt: number } | undefined {
      const row = oneList.get(key);
      if (row === undefined) return undefined;
      const parsed = ListRow.parse(row);
      return {
        ids: z.array(z.unknown()).parse(JSON.parse(parsed.ids)).map(Number),
        totalPages: parsed.total_pages,
        totalResults: parsed.total_results,
        fetchedAt: parsed.fetched_at,
      };
    },
    putList(key: string, ids: number[], totalPages: number, totalResults: number, fetchedAt: number): void {
      upsertList.run(key, JSON.stringify(ids), totalPages, totalResults, fetchedAt);
    },
    /** `{ total, stale }` of the TMDB titles against the freshness age, for the sync status. */
    counts(staleAgeMs: number): { total: number; stale: number } {
      const row = z.object({ total: z.number(), stale: z.number().nullable() }).parse(counts.get(staleAgeMs));
      return { total: row.total, stale: row.stale ?? 0 };
    },
  };
}

export type TitleRepository = ReturnType<typeof createTitleRepository>;
