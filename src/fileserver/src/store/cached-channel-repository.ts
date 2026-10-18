import { z } from "zod";

import type { CachedChannelRow } from "../types/backend-cache.js";
import type { Database } from "./database.js";

const Row = z.object({
  id: z.string(),
  position: z.number(),
  name: z.string(),
  number: z.string().nullable(),
  category: z.string(),
  logo_url: z.string().nullable(),
  stream_url: z.string(),
  revision: z.number(),
});
const CategoryRow = z.object({ value: z.string(), count: z.number() });

export interface ChannelFilter {
  q?: string;
  category?: string;
}

export interface CachedChannelRepository {
  /** Replace every row with `rows`; the caller wraps it in the sync's transaction (`commitSynced`). */
  replaceAll(rows: readonly CachedChannelRow[]): void;
  /** Rows in the backend's order; `q` is a case-insensitive substring of the name or number. */
  list(filter: ChannelFilter): CachedChannelRow[];
  /** Each category and its channel count over every row. */
  categories(): Array<{ value: string; count: number }>;
  has(id: string): boolean;
  count(): number;
}

/** Make `%`, `_` and the escape itself literal inside a LIKE pattern. */
function likeOf(text: string): string {
  return `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

export function createCachedChannelRepository(db: Database): CachedChannelRepository {
  const clear = db.prepare("DELETE FROM cached_channels");
  const insert = db.prepare(
    `INSERT INTO cached_channels (id, position, name, number, category, logo_url, stream_url, revision)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const list = db.prepare(
    `SELECT * FROM cached_channels
     WHERE (:q IS NULL OR name LIKE :q ESCAPE '\\' OR COALESCE(number, '') LIKE :q ESCAPE '\\')
       AND (:category IS NULL OR category = :category)
     ORDER BY position`,
  );
  const categories = db.prepare(
    "SELECT category AS value, COUNT(*) AS count FROM cached_channels GROUP BY category ORDER BY category",
  );
  const has = db.prepare("SELECT 1 AS found FROM cached_channels WHERE id = ?");
  const count = db.prepare("SELECT COUNT(*) AS total FROM cached_channels");

  return {
    replaceAll(rows) {
      clear.run();
      for (const row of rows) {
        insert.run(
          row.id,
          row.position,
          row.name,
          row.number ?? null,
          row.category,
          row.logoUrl ?? null,
          row.streamUrl,
          row.revision,
        );
      }
    },

    list(filter) {
      const found = list.all({ q: filter.q === undefined ? null : likeOf(filter.q), category: filter.category ?? null });
      return found.flatMap((raw) => {
        const parsed = Row.safeParse(raw);
        if (!parsed.success) return [];
        const row = parsed.data;
        return [
          {
            id: row.id,
            position: row.position,
            name: row.name,
            category: row.category,
            streamUrl: row.stream_url,
            revision: row.revision,
            ...(row.number !== null && { number: row.number }),
            ...(row.logo_url !== null && { logoUrl: row.logo_url }),
          },
        ];
      });
    },

    categories() {
      return categories.all().flatMap((raw) => {
        const parsed = CategoryRow.safeParse(raw);
        return parsed.success ? [parsed.data] : [];
      });
    },

    has(id) {
      return has.get(id) !== undefined;
    },

    count() {
      return z.object({ total: z.number() }).parse(count.get()).total;
    },
  };
}
