import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";

import type { BackendProvider } from "../types/provider.js";

const ProviderRow = z.object({
  id: z.number(),
  name: z.string(),
  source: z.string(),
  api_key: z.string().nullable(),
  is_active: z.number(),
  created_at: z.string(),
});

function toProvider(row: unknown): BackendProvider {
  const r = ProviderRow.parse(row);
  return {
    id: r.id,
    name: r.name,
    source: r.source,
    api_key: r.api_key ?? "",
    is_active: r.is_active === 1,
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
}

/**
 * The providers table (docs/03 section 7.2b). Ordered by name then id.
 */
export function createProviderRepository(db: DatabaseSync) {
  const all = db.prepare(`
    SELECT id, name, source, api_key, is_active, created_at FROM providers
    ORDER BY name COLLATE NOCASE, id`);
  const one = db.prepare("SELECT id, name, source, api_key, is_active, created_at FROM providers WHERE id = ?");
  const insert = db.prepare(`
    INSERT INTO providers (name, source, api_key, is_active, created_at)
    VALUES (?, ?, ?, 1, ?)`);
  const update = db.prepare(`
    UPDATE providers SET name = ?, source = ?, api_key = ?, is_active = ? WHERE id = ?`);
  const remove = db.prepare("DELETE FROM providers WHERE id = ?");

  return {
    list: (): BackendProvider[] => all.all().map(toProvider),
    find(id: number): BackendProvider | undefined {
      const row = one.get(id);
      return row === undefined ? undefined : toProvider(row);
    },
    isEmpty: (): boolean => all.all().length === 0,
    insert(c: Omit<ProviderRecord, "id">): number {
      const result = insert.run(c.name, c.source, c.api_key, c.created_at);
      return Number(result.lastInsertRowid);
    },
    update(c: ProviderRecord): boolean {
      return Number(update.run(c.name, c.source, c.api_key, c.is_active, c.id).changes) > 0;
    },
    remove(id: number): boolean {
      return Number(remove.run(id).changes) > 0;
    },
  };
}

export type ProviderRepository = ReturnType<typeof createProviderRepository>;
