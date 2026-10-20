import { z } from "zod";

import type { TitleKind, TitleSort } from "./admin-title-repository.js";
import type { TitleFilter, TitlePageRequest, TitlePageResult } from "../types/cached-title.js";
import { cachedTitlesOf, TITLE_COLUMNS } from "./cached-title-row.js";
import type { Database } from "./database.js";

type Param = string | number;

/** Every sort ends with the title (no case) and the id, so a page boundary is total (docs/46 section A). */
const TIE = "t.title COLLATE NOCASE, t.id";
const BY_POPULARITY = "t.popularity IS NULL, t.popularity DESC";
const ORDER: Record<TitleSort, string> = {
  newest: `t.year IS NULL, t.year DESC, ${BY_POPULARITY}, ${TIE}`,
  oldest: `t.year IS NULL, t.year ASC, ${BY_POPULARITY}, ${TIE}`,
  year: `t.year IS NULL, t.year DESC, ${TIE}`,
  az: TIE,
  trending: `${BY_POPULARITY}, ${TIE}`,
};
/** A search is ordered by popularity whatever the chosen sort (docs/46 section A). */
const SEARCH_ORDER = `${BY_POPULARITY}, ${TIE}`;

const Count = z.object({ total: z.number() });
const IdRow = z.object({ id: z.string() });
const GenreName = z.object({ genre: z.string() });

/** Make `%`, `_` and the escape itself literal inside a LIKE pattern. */
const likeOf = (text: string): string => `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
const marks = (count: number): string => Array.from({ length: count }, () => "?").join(", ");

/** The WHERE of a filter over alias `t`, with its parameters in order. */
function whereOf(filter: TitleFilter): { sql: string; params: Param[] } {
  const parts: string[] = [];
  const params: Param[] = [];
  if (filter.kinds.length === 0) parts.push("0");
  else if (filter.kinds.length === 1) {
    parts.push("t.kind = ?");
    params.push(filter.kinds[0] ?? "movie");
  }
  if (filter.q !== undefined) {
    parts.push("t.title LIKE ? ESCAPE '\\'");
    params.push(likeOf(filter.q));
  }
  if (filter.genres.length > 0) {
    parts.push(
      `t.id IN (SELECT g.title_id FROM cached_title_genres g WHERE g.genre IN (${marks(filter.genres.length)}))`,
    );
    params.push(...filter.genres);
  }
  if (filter.year !== undefined) {
    parts.push("t.year = ?");
    params.push(filter.year);
  }
  if (filter.unwatched) {
    parts.push("NOT EXISTS (SELECT 1 FROM watch_entries w WHERE w.item_kind = 'title' AND w.item_id = t.id)");
  }
  return { sql: parts.length === 0 ? "1" : parts.join(" AND "), params };
}

export interface CachedTitleQuery {
  /** One page of the matching cached titles and the exact count of all of them. */
  page(request: TitlePageRequest): TitlePageResult;
  /** The distinct genre names the cached titles of these kinds carry. */
  genreFacets(kinds: readonly TitleKind[]): string[];
  /** Whether any cached title of these kinds has a stored popularity (the trending sort can be offered). */
  hasPopularity(kinds: readonly TitleKind[]): boolean;
}

/** The cached titles' reads (docs/46 sections A and B): SQL lives here and nowhere else. */
export function createCachedTitleQuery(db: Database): CachedTitleQuery {
  // The shapes repeat (a sort, a filter set, a genre count), so statements are kept once prepared.
  const statements = new Map<string, ReturnType<Database["prepare"]>>();
  const prepared = (sql: string): ReturnType<Database["prepare"]> => {
    let statement = statements.get(sql);
    if (statement === undefined) {
      statement = db.prepare(sql);
      statements.set(sql, statement);
    }
    return statement;
  };
  const kindsOf = (kinds: readonly TitleKind[]): Param[] => (kinds.length === 0 ? ["none"] : [...kinds]);

  return {
    page(request) {
      const where = whereOf(request);
      const counted = Count.parse(prepared(`SELECT COUNT(*) AS total FROM cached_titles t WHERE ${where.sql}`).get(...where.params));
      if (request.limit <= 0 || request.offset >= counted.total) return { rows: [], total: counted.total };
      const order = request.q !== undefined ? SEARCH_ORDER : ORDER[request.sort];
      // Rank on the id alone: a sort that carries the wide columns (and the per-row genre subquery) pays for every
      // matching row, so the page's rows are read afterwards, by id, in the ranked order.
      const ids = prepared(`SELECT t.id FROM cached_titles t WHERE ${where.sql} ORDER BY ${order} LIMIT ? OFFSET ?`)
        .all(...where.params, request.limit, request.offset)
        .flatMap((raw) => {
          const row = IdRow.safeParse(raw);
          return row.success ? [row.data.id] : [];
        });
      if (ids.length === 0) return { rows: [], total: counted.total };
      const fetched = cachedTitlesOf(
        prepared(`SELECT ${TITLE_COLUMNS} FROM cached_titles t WHERE t.id IN (${marks(ids.length)})`).all(...ids),
      );
      const byId = new Map(fetched.map((title) => [title.id, title]));
      return { rows: ids.flatMap((id) => byId.get(id) ?? []), total: counted.total };
    },

    genreFacets(kinds) {
      // Both kinds need no join: the genre index alone yields the distinct names.
      const both = kinds.length === 2;
      const sql = both
        ? "SELECT DISTINCT genre FROM cached_title_genres ORDER BY genre COLLATE NOCASE"
        : `SELECT DISTINCT g.genre AS genre FROM cached_title_genres g JOIN cached_titles t ON t.id = g.title_id
           WHERE t.kind IN (${marks(kindsOf(kinds).length)}) ORDER BY g.genre COLLATE NOCASE`;
      return prepared(sql)
        .all(...(both ? [] : kindsOf(kinds)))
        .flatMap((raw) => {
          const row = GenreName.safeParse(raw);
          return row.success ? [row.data.genre] : [];
        });
    },

    hasPopularity(kinds) {
      if (kinds.length === 0) return false;
      const sql = `SELECT 1 AS found FROM cached_titles t WHERE t.popularity IS NOT NULL AND t.kind IN (${marks(kinds.length)}) LIMIT 1`;
      return prepared(sql).get(...kinds) !== undefined;
    },
  };
}
