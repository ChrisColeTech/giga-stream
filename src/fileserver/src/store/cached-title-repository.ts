import { z } from "zod";

import type { TitleKind } from "../services/admin-titles.js";
import type { CachedTitle, CatalogItem, DetailWrite, GenreEntry } from "../types/cached-title.js";
import { cachedTitleOf, cachedTitlesOf, TITLE_COLUMNS } from "./cached-title-row.js";
import type { Database } from "./database.js";
import { inTransaction } from "./transaction.js";

export interface CachedTitleRepository {
  /** Upsert one catalog page in one transaction: list columns overwritten, detail columns untouched. */
  upsertPage(rows: readonly CatalogItem[], run: number): void;
  /** Delete the catalog titles the walk of `run` did not see; spared: off-catalog rows. Runs in the caller's transaction. */
  sweep(run: number): void;
  /** Replace one kind's genre dictionary in one transaction. */
  replaceGenres(kind: TitleKind, entries: readonly GenreEntry[]): void;
  /** Id -> name for one kind's stored dictionary (empty when none was stored). */
  genreNames(kind: TitleKind): Map<string, string>;
  /** A live detail's display fields written through; inserted as an off-catalog row when not cached. */
  writeDetail(detail: DetailWrite): void;
  get(id: string): CachedTitle | undefined;
  byIds(ids: readonly string[]): CachedTitle[];
  /** Whether the cache holds any title row. */
  hasAny(): boolean;
}

const LIST_SET = `kind = excluded.kind, title = excluded.title, year = excluded.year, rating = excluded.rating,
  poster_url = excluded.poster_url, backdrop_url = excluded.backdrop_url`;

export function createCachedTitleRepository(db: Database): CachedTitleRepository {
  const upsert = db.prepare(
    `INSERT INTO cached_titles (id, kind, title, year, rating, popularity, poster_url, backdrop_url, in_catalog, seen_run)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
     ON CONFLICT (id) DO UPDATE SET ${LIST_SET}, popularity = excluded.popularity, in_catalog = 1, seen_run = excluded.seen_run`,
  );
  const detail = db.prepare(
    `INSERT INTO cached_titles (id, kind, title, year, rating, poster_url, backdrop_url, plot, cast_json, runtime_ms,
       seasons_json, detail_at, in_catalog, seen_run)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
     ON CONFLICT (id) DO UPDATE SET ${LIST_SET}, plot = excluded.plot, cast_json = excluded.cast_json,
       runtime_ms = excluded.runtime_ms, seasons_json = excluded.seasons_json, detail_at = excluded.detail_at`,
  );
  const clearGenres = db.prepare("DELETE FROM cached_title_genres WHERE title_id = ?");
  const addGenre = db.prepare("INSERT OR IGNORE INTO cached_title_genres (title_id, genre) VALUES (?, ?)");
  const sweep = db.prepare("DELETE FROM cached_titles WHERE in_catalog = 1 AND seen_run < ?");
  const clearDictionary = db.prepare("DELETE FROM cached_genres WHERE kind = ?");
  const addDictionary = db.prepare("INSERT OR REPLACE INTO cached_genres (kind, id, name) VALUES (?, ?, ?)");
  const dictionary = db.prepare("SELECT id, name FROM cached_genres WHERE kind = ?");
  const one = db.prepare(`SELECT ${TITLE_COLUMNS} FROM cached_titles t WHERE t.id = ?`);
  const any = db.prepare("SELECT 1 AS found FROM cached_titles LIMIT 1");
  const DictionaryRow = z.object({ id: z.string(), name: z.string() });

  const setGenres = (id: string, genres: readonly string[]): void => {
    clearGenres.run(id);
    for (const genre of genres) addGenre.run(id, genre);
  };

  return {
    upsertPage(rows, run) {
      inTransaction(db, () => {
        for (const row of rows) {
          upsert.run(
            row.id, row.kind, row.title, row.year ?? null, row.rating ?? null, row.popularity ?? null,
            row.posterUrl ?? null, row.backdropUrl ?? null, run,
          );
          setGenres(row.id, row.genres);
        }
      });
    },

    sweep(run) {
      sweep.run(run);
    },

    replaceGenres(kind, entries) {
      inTransaction(db, () => {
        clearDictionary.run(kind);
        for (const entry of entries) addDictionary.run(kind, String(entry.id), entry.name);
      });
    },

    genreNames(kind) {
      const names = new Map<string, string>();
      for (const raw of dictionary.all(kind)) {
        const row = DictionaryRow.safeParse(raw);
        if (row.success) names.set(row.data.id, row.data.name);
      }
      return names;
    },

    writeDetail(write) {
      inTransaction(db, () => {
        detail.run(
          write.id, write.kind, write.title, write.year ?? null, write.rating ?? null, write.posterUrl ?? null,
          write.backdropUrl ?? null, write.plot ?? null, JSON.stringify(write.cast),
          write.runtimeMs ?? null, write.seasons.length > 0 ? JSON.stringify(write.seasons) : null, write.at,
        );
        setGenres(write.id, write.genres);
      });
    },

    get: (id) => cachedTitleOf(one.get(id)),

    byIds(ids) {
      if (ids.length === 0) return [];
      const marks = ids.map(() => "?").join(", ");
      return cachedTitlesOf(db.prepare(`SELECT ${TITLE_COLUMNS} FROM cached_titles t WHERE t.id IN (${marks})`).all(...ids));
    },

    hasAny: () => any.get() !== undefined,
  };
}
