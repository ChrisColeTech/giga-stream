import { existsSync } from "node:fs";
import { z } from "zod";

import { createClient } from "@libsql/client";

import { LIVE_CATEGORIES, LIVE_MODES, VARIANT_NAMES } from "../constants/live-media.js";
import type { LiveRecord } from "../types/channel.js";
import { fileUrl } from "./database.js";

const LegacyRow = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(LIVE_CATEGORIES),
  number: z.number().int(),
  mode: z.enum(LIVE_MODES),
  captions: z.number().int(),
  variants: z.string(),
  folder: z.string().nullable(),
});
const Variants = z.array(z.enum(VARIANT_NAMES));
const PathRow = z.object({ path: z.string() });
const IdentityRow = z.object({ id: z.string(), number: z.string().nullable() });
const ColumnRow = z.object({ name: z.string() });

/**
 * The channels of the old live server's own database (`live-server.db`, docs/10 section 3.2), read-only, as
 * live rows ready for the merged store. Only the one-shot importer calls this; the server never does (docs/26 D13).
 * The legacy file is opened plain: no pragmas, so nothing about it is rewritten by the reading.
 */
export async function readLegacyChannels(file: string): Promise<LiveRecord[]> {
  const db = createClient({ url: fileUrl(file), authToken: undefined });
  try {
    const videosSql = "SELECT path FROM channel_videos WHERE channel_id = ? ORDER BY position";
    const rows = (await db.execute("SELECT id, name, category, number, mode, captions, variants, folder FROM channels ORDER BY number")).rows;
    return await Promise.all(rows.map(async (row) => {
      const r = LegacyRow.parse(row);
      const videos = (await db.execute({ sql: videosSql, args: [r.id] })).rows.map((v) => PathRow.parse(v).path);
      const live: LiveRecord = {
        kind: "live",
        id: r.id,
        name: r.name,
        category: r.category,
        number: String(r.number),
        logoUrl: null,
        revision: 0,
        enabled: true,
        published: true,
        live: {
          mode: r.mode,
          captions: r.captions === 1,
          variants: Variants.parse(JSON.parse(r.variants)),
          folder: r.folder,
          videos,
        },
      };
      return live;
    }));
  } finally {
    db.close();
  }
}

/** The ids and live numbers already in a backend database, read without migrating or writing it. */
export async function readExistingIdentities(file: string): Promise<{ ids: Set<string>; liveNumbers: Map<string, string> }> {
  const found = { ids: new Set<string>(), liveNumbers: new Map<string, string>() };
  if (!existsSync(file)) return found;
  const db = createClient({ url: fileUrl(file), authToken: undefined });
  try {
    const columns = (await db.execute("PRAGMA table_info(channels)")).rows.map((row) => ColumnRow.parse(row).name);
    // A database from before the live channels has no `kind` column, and so no live rows.
    const live = columns.includes("kind");
    const rows = (await db.execute(`SELECT id, number${live ? ", kind" : ""} FROM channels`)).rows;
    for (const row of rows) {
      const { id, number } = IdentityRow.parse(row);
      found.ids.add(id);
      if (live && number !== null && z.object({ kind: z.string() }).parse(row).kind === "live") {
        found.liveNumbers.set(number, id);
      }
    }
  } finally {
    db.close();
  }
  return found;
}
