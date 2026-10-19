import type { Database } from "./database.js";

import type { StoredTitle } from "./title-repository.js";

/**
 * The catalog read in SQL (docs/03 section 7.4): the enabled titles, synced and made by hand, in `id` order after a
 * keyset cursor. A deleted synced title has no stored copy (migration 020), so it is never here.
 */
export function createTitleCatalog(db: Database, columns: string, toStored: (row: unknown) => Promise<StoredTitle>) {
  const firstSql = `SELECT ${columns} FROM titles WHERE enabled = 1 ORDER BY id LIMIT ?`;
  const followingSql = `SELECT ${columns} FROM titles WHERE enabled = 1 AND id > ? ORDER BY id LIMIT ?`;
  return {
    /** Up to `limit` enabled rows with an id after `afterId` (all from the start when it is undefined). */
    async catalog(afterId: string | undefined, limit: number): Promise<StoredTitle[]> {
      const rows = afterId === undefined
        ? (await db.execute({ sql: firstSql, args: [limit] })).rows
        : (await db.execute({ sql: followingSql, args: [afterId, limit] })).rows;
      return Promise.all(rows.map(toStored));
    },
  };
}
