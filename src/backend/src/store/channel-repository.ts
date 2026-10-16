import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";

import type { BackendChannel } from "../types/channel.js";

const ChannelRow = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  number: z.string().nullable(),
  logo_url: z.string().nullable(),
  tvg_id: z.string().nullable(),
  source: z.string().nullable(),
  stream_url: z.string(),
  revision: z.number().int(),
});

function toChannel(row: unknown): BackendChannel {
  const r = ChannelRow.parse(row);
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    ...(r.number !== null && { number: r.number }),
    ...(r.logo_url !== null && { logoUrl: r.logo_url }),
    ...(r.tvg_id !== null && { tvgId: r.tvg_id }),
    ...(r.source !== null && { source: r.source }),
    streamUrl: r.stream_url,
    revision: r.revision,
  };
}

/** What a row holds, written whole on create and on every change. */
export interface ChannelRecord {
  id: string;
  name: string;
  category: string;
  number: string | null;
  logoUrl: string | null;
  tvgId: string | null;
  source: string | null;
  streamUrl: string;
  revision: number;
}

const COLUMNS = "id, name, category, number, logo_url, tvg_id, source, stream_url, revision";

/**
 * The channels table. Ordered by number then name (docs/03 section 7.2): numbered channels first, by
 * their numeric value, then the rest by name.
 */
export function createChannelRepository(db: DatabaseSync) {
  const all = db.prepare(`
    SELECT ${COLUMNS} FROM channels
    ORDER BY number IS NULL, CAST(number AS INTEGER), number, name COLLATE NOCASE, id`);
  const one = db.prepare(`SELECT ${COLUMNS} FROM channels WHERE id = ?`);
  const count = db.prepare("SELECT COUNT(*) AS n FROM channels");
  const insert = db.prepare(`
    INSERT INTO channels (id, name, category, number, logo_url, tvg_id, source, stream_url, revision, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const update = db.prepare(`
    UPDATE channels
    SET name = ?, category = ?, number = ?, logo_url = ?, tvg_id = ?, source = ?, stream_url = ?, revision = ?
    WHERE id = ?`);
  const remove = db.prepare("DELETE FROM channels WHERE id = ?");

  return {
    list: (): BackendChannel[] => all.all().map(toChannel),
    find(id: string): BackendChannel | undefined {
      const row = one.get(id);
      return row === undefined ? undefined : toChannel(row);
    },
    isEmpty: (): boolean => z.object({ n: z.number() }).parse(count.get()).n === 0,
    insert(c: ChannelRecord, createdAt: number): void {
      insert.run(c.id, c.name, c.category, c.number, c.logoUrl, c.tvgId, c.source, c.streamUrl, c.revision, createdAt);
    },
    update(c: ChannelRecord): void {
      update.run(c.name, c.category, c.number, c.logoUrl, c.tvgId, c.source, c.streamUrl, c.revision, c.id);
    },
    remove(id: string): boolean {
      return Number(remove.run(id).changes) > 0;
    },
  };
}

export type ChannelRepository = ReturnType<typeof createChannelRepository>;
