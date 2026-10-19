import { z } from "zod";

import type { ChannelRecord } from "../types/channel.js";
import type { ChannelFilter, ChannelPageRequest, ChannelSort, SortDir } from "../types/channel-query.js";
import type { Database, SqlArgs } from "./database.js";
import { CHANNEL_FROM, CHANNEL_SELECT } from "./channel-columns.js";
import { LIKE_ESCAPE, containsPattern } from "./like-pattern.js";

const CountRow = z.object({ n: z.number() });
const EDITED = "(c.edited_fields IS NOT NULL AND c.edited_fields <> '[]')";

/** A stream row with a parent playlist and no edits is synced, with edits edited; with no parent it is manual. */
const ORIGIN_WHERE = {
  synced: `c.kind = 'stream' AND c.playlist_id IS NOT NULL AND NOT ${EDITED}`,
  edited: `c.kind = 'stream' AND c.playlist_id IS NOT NULL AND ${EDITED}`,
  manual: "c.kind = 'stream' AND c.playlist_id IS NULL",
} as const;

/** The sync's verdict (docs/43 section 3.3, the words of docs/51); `unchecked` is a stream row never checked. */
const STATUS_WHERE = {
  online: "c.kind = 'stream' AND c.status = 'online'",
  offline: "c.kind = 'stream' AND c.status = 'offline'",
  unchecked: "c.kind = 'stream' AND c.status IS NULL",
} as const;

const SEARCHED = ["c.name", "c.number", "c.tvg_id", "p.name", "p.host"] as const;

function whereOf(filter: ChannelFilter): { sql: string; params: SqlArgs } {
  const clauses: string[] = [];
  const params: SqlArgs = [];
  if (filter.q !== undefined) {
    clauses.push(`(${SEARCHED.map((column) => `${column} LIKE ? ${LIKE_ESCAPE}`).join(" OR ")})`);
    const pattern = containsPattern(filter.q);
    params.push(...SEARCHED.map(() => pattern));
  }
  if (filter.kind !== undefined) {
    clauses.push("c.kind = ?");
    params.push(filter.kind);
  }
  if (filter.origin !== undefined) clauses.push(ORIGIN_WHERE[filter.origin]);
  if (filter.status !== undefined) clauses.push(STATUS_WHERE[filter.status]);
  if (filter.playlist !== undefined) {
    clauses.push("c.playlist_id = ?");
    params.push(filter.playlist);
  }
  if (filter.enabled !== undefined) {
    clauses.push("c.enabled = ?");
    params.push(filter.enabled ? 1 : 0);
  }
  if (filter.ids !== undefined) {
    clauses.push("c.id IN (SELECT value FROM json_each(?))");
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
    number: `c.number IS NULL, CAST(c.number AS INTEGER) ${d}, c.number ${d}`,
    name: `c.name COLLATE NOCASE ${d}`,
    category: `c.category COLLATE NOCASE ${d}`,
    kind: `c.kind ${d}`,
    playlist: `p.name IS NULL, p.name COLLATE NOCASE ${d}`,
  };
  return `ORDER BY ${primary[sort]}, c.name COLLATE NOCASE, c.id`;
}

/** One page of the channels in SQL, and the count of every row the filters keep (docs/41 section 3.1). */
export function createChannelPage(db: Database, toRecord: (row: unknown) => Promise<ChannelRecord>) {
  return async (request: ChannelPageRequest): Promise<{ rows: ChannelRecord[]; total: number }> => {
    const where = whereOf(request.filter);
    const total = CountRow.parse(
      (await db.execute({ sql: `SELECT COUNT(*) AS n FROM ${CHANNEL_FROM} ${where.sql}`, args: where.params })).rows[0],
    ).n;
    const rows = (await db.execute({
      sql: `SELECT ${CHANNEL_SELECT} FROM ${CHANNEL_FROM} ${where.sql} ${orderOf(request.sort, request.dir)} LIMIT ? OFFSET ?`,
      args: [...where.params, request.limit, request.offset],
    })).rows;
    return { rows: await Promise.all(rows.map(toRecord)), total };
  };
}
