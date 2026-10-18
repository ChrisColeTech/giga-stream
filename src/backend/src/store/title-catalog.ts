import type { DatabaseSync } from "node:sqlite";

import type { StoredTitle } from "./title-repository.js";

/**
 * The catalog read in SQL (docs/03 section 7.4): the enabled titles, synced and made by hand, in `id` order after a
 * keyset cursor. A deleted synced title has no stored copy (migration 020), so it is never here.
 */
export function createTitleCatalog(db: DatabaseSync, columns: string, toStored: (row: unknown) => StoredTitle) {
  const first = db.prepare(`SELECT ${columns} FROM titles WHERE enabled = 1 ORDER BY id LIMIT ?`);
  const following = db.prepare(`SELECT ${columns} FROM titles WHERE enabled = 1 AND id > ? ORDER BY id LIMIT ?`);
  return {
    /** Up to `limit` enabled rows with an id after `afterId` (all from the start when it is undefined). */
    catalog(afterId: string | undefined, limit: number): StoredTitle[] {
      const rows = afterId === undefined ? first.all(limit) : following.all(afterId, limit);
      return rows.map(toStored);
    },
  };
}
