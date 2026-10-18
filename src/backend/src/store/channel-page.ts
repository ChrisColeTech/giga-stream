import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import { z } from "zod";

import type { ChannelRecord } from "../types/channel.js";
import type { ChannelFilter, ChannelPageRequest, ChannelSort, SortDir } from "../types/channel-query.js";
import { LIKE_ESCAPE, containsPattern } from "./like-pattern.js";

const CountRow = z.object({ n: z.number() });
const EDITED = "(edited_fields IS NOT NULL AND edited_fields <> '[]')";

/** A stream row with a `source` and no edits is synced, with edits edited; a stream row with no `source` is manual. */
const ORIGIN_WHERE = {
  synced: `kind = 'stream' AND source IS NOT NULL AND NOT ${EDITED}`,
  edited: `kind = 'stream' AND source IS NOT NULL AND ${EDITED}`,
  manual: "kind = 'stream' AND source IS NULL",
} as const;

function whereOf(filter: ChannelFilter): { sql: string; params: SQLInputValue[] } {
  const clauses: string[] = [];
  const params: SQLInputValue[] = [];
  if (filter.q !== undefined) {
    const like = (column: string) => `${column} LIKE ? ${LIKE_ESCAPE}`;
    clauses.push(`(${["name", "number", "tvg_id", "source"].map(like).join(" OR ")})`);
    const pattern = containsPattern(filter.q);
    params.push(pattern, pattern, pattern, pattern);
  }
  if (filter.kind !== undefined) {
    clauses.push("kind = ?");
    params.push(filter.kind);
  }
  if (filter.origin !== undefined) clauses.push(ORIGIN_WHERE[filter.origin]);
  if (filter.enabled !== undefined) {
    clauses.push("enabled = ?");
    params.push(filter.enabled ? 1 : 0);
  }
  if (filter.source !== undefined) {
    clauses.push("source = ?");
    params.push(filter.source);
  }
  if (filter.ids !== undefined) {
    clauses.push("id IN (SELECT value FROM json_each(?))");
    params.push(JSON.stringify(filter.ids));
  }
  return { sql: clauses.length === 0 ? "" : `WHERE ${clauses.join(" AND ")}`, params };
}

/**
 * The order is total and stable (docs/41 section 3.1): the chosen column (rows without a value last in either
 * direction), then the name, then the id. `number` is numeric: 2 before 10.
 */
function orderOf(sort: ChannelSort, dir: SortDir): string {
  const d = dir === "desc" ? "DESC" : "ASC";
  const primary: Record<ChannelSort, string> = {
    number: `number IS NULL, CAST(number AS INTEGER) ${d}, number ${d}`,
    name: `name COLLATE NOCASE ${d}`,
    category: `category COLLATE NOCASE ${d}`,
    kind: `kind ${d}`,
    source: `source IS NULL, source COLLATE NOCASE ${d}`,
  };
  return `ORDER BY ${primary[sort]}, name COLLATE NOCASE, id`;
}

/** One page of the channels in SQL, and the count of every row the filters keep (docs/41 section 3.1). */
export function createChannelPage(db: DatabaseSync, columns: string, toRecord: (row: unknown) => ChannelRecord) {
  return (request: ChannelPageRequest): { rows: ChannelRecord[]; total: number } => {
    const where = whereOf(request.filter);
    const total = CountRow.parse(db.prepare(`SELECT COUNT(*) AS n FROM channels ${where.sql}`).get(...where.params)).n;
    const rows = db
      .prepare(`SELECT ${columns} FROM channels ${where.sql} ${orderOf(request.sort, request.dir)} LIMIT ? OFFSET ?`)
      .all(...where.params, request.limit, request.offset)
      .map(toRecord);
    return { rows, total };
  };
}
