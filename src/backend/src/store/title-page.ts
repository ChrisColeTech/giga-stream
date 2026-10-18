import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import { z } from "zod";

import type { StoredSort, StoredTitleFilter, TitleInventory } from "../types/title-stored.js";
import { LIKE_ESCAPE, containsPattern } from "./like-pattern.js";
import type { StoredTitle } from "./title-repository.js";

const CountRow = z.object({ n: z.number() });
const InventoryRow = z.object({
  movie: z.number().nullable(),
  tv: z.number().nullable(),
  manual: z.number().nullable(),
  edited: z.number().nullable(),
  disabled: z.number().nullable(),
  version: z.string(),
});

const TITLE = "json_extract(payload, '$.title')";
const EDITED = "(edited_fields IS NOT NULL AND edited_fields <> '[]')";

function whereOf(filter: StoredTitleFilter): { sql: string; params: SQLInputValue[] } {
  const clauses: string[] = [];
  const params: SQLInputValue[] = [];
  if (filter.q !== undefined) {
    clauses.push(`${TITLE} LIKE ? ${LIKE_ESCAPE}`);
    params.push(containsPattern(filter.q));
  }
  if (filter.kind !== undefined) {
    clauses.push("kind = ?");
    params.push(filter.kind);
  }
  if (filter.origin !== undefined) {
    clauses.push("origin = ?");
    params.push(filter.origin);
  }
  if (filter.edited !== undefined) clauses.push(filter.edited ? EDITED : `NOT ${EDITED}`);
  if (filter.enabled !== undefined) {
    clauses.push("enabled = ?");
    params.push(filter.enabled ? 1 : 0);
  }
  return { sql: clauses.length === 0 ? "" : `WHERE ${clauses.join(" AND ")}`, params };
}

/** A total order (docs/41 section 3.2): the column (rows without a value last in either direction), then the id. */
function orderOf(sort: StoredSort, dir: "asc" | "desc"): string {
  const d = dir === "desc" ? "DESC" : "ASC";
  const byJson = (path: string) => `json_extract(payload, '$.${path}') IS NULL, json_extract(payload, '$.${path}') ${d}`;
  const primary: Record<StoredSort, string> = {
    title: `${TITLE} COLLATE NOCASE ${d}`,
    year: byJson("year"),
    rating: byJson("rating"),
    fetched: `fetched_at ${d}`,
  };
  return `ORDER BY ${primary[sort]}, id`;
}

/**
 * The stored-titles list in SQL (docs/41 section 3.2): one page of every row of `titles`, synced and made by hand, with
 * the count the filters keep; and the whole store's inventory and change marker. A deleted synced title has no stored
 * copy (migration 020), so it is never here.
 */
export function createTitlePage(db: DatabaseSync, columns: string, toStored: (row: unknown) => StoredTitle) {
  const inventory = db.prepare(`
    SELECT SUM(kind = 'movie') AS movie, SUM(kind = 'tv') AS tv, SUM(origin = 'manual') AS manual,
      SUM(${EDITED}) AS edited, SUM(enabled = 0) AS disabled,
      COUNT(*) || ':' || COALESCE(MAX(fetched_at), 0) AS version
    FROM titles`);
  return {
    page(filter: StoredTitleFilter, sort: StoredSort, dir: "asc" | "desc", limit: number, offset: number) {
      const where = whereOf(filter);
      const total = CountRow.parse(db.prepare(`SELECT COUNT(*) AS n FROM titles ${where.sql}`).get(...where.params)).n;
      const rows = db
        .prepare(`SELECT ${columns} FROM titles ${where.sql} ${orderOf(sort, dir)} LIMIT ? OFFSET ?`)
        .all(...where.params, limit, offset)
        .map(toStored);
      return { rows, total };
    },
    inventory(): { counts: TitleInventory; version: string } {
      const { version, ...counts } = InventoryRow.parse(inventory.get());
      return {
        counts: {
          movie: counts.movie ?? 0, tv: counts.tv ?? 0, manual: counts.manual ?? 0,
          edited: counts.edited ?? 0, disabled: counts.disabled ?? 0,
        },
        version,
      };
    },
  };
}
