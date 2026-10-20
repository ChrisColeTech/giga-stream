import { z } from "zod";

import type { AdminDatabase } from "./admin-database.js";
import type { AdminResult } from "../services/admin-failure.js";
import { badResponse, unreachable } from "../services/admin-failure.js";

export interface PublishedChannel {
  id: string;
  name: string;
  category: string;
  number?: string;
  logoUrl?: string;
  cachedLogoUrl?: string;
  streamUrl: string;
  revision: number;
}

export interface PublishedChannels {
  items: PublishedChannel[];
  revision: number;
}

const Row = z.object({
  id: z.string(), name: z.string(), category: z.string(), number: z.string().nullable(),
  logo_url: z.string().nullable(), logo_file: z.string().nullable(), stream_url: z.string().nullable(),
  kind: z.enum(["stream", "live"]), revision: z.coerce.number(),
});
const RevisionRow = z.object({ revision: z.coerce.number() });

const SQL = `SELECT c.id, c.name, c.category, c.number, c.logo_url, c.logo_file, c.stream_url,
  c.kind, c.revision FROM channels c LEFT JOIN playlists p ON p.id = c.playlist_id
  WHERE c.enabled = 1 AND (c.playlist_id IS NULL OR p.enabled = 1)
  ORDER BY c.number IS NULL, CAST(c.number AS INTEGER), c.number, c.name COLLATE NOCASE, c.id`;

/** Published channels directly from the backend schema (docs/03 7.2 and docs/64). */
export function createAdminChannelRepository(database: AdminDatabase, mediaOrigin: () => string) {
  return {
    async list(): Promise<AdminResult<PublishedChannels>> {
      try {
        const [channels, revision] = await database.batch([
          { sql: SQL, args: [] },
          { sql: "SELECT revision FROM backend_revision WHERE id = 1", args: [] },
        ]);
        const revisionRow = RevisionRow.safeParse(revision?.rows[0]);
        if (channels === undefined || !revisionRow.success) return { ok: false, failure: badResponse };
        const items: PublishedChannel[] = [];
        for (const raw of channels.rows) {
          const parsed = Row.safeParse(raw);
          if (!parsed.success) return { ok: false, failure: badResponse };
          const row = parsed.data;
          const base = mediaOrigin().replace(/\/$/, "");
          const streamUrl = row.kind === "live" ? `${base}/live/${row.id}/master.m3u8` : row.stream_url;
          if (streamUrl === null) return { ok: false, failure: badResponse };
          const logoUrl = row.logo_file !== null
            ? `${base}/logos/c/${row.logo_file}`
            : row.kind === "live" ? `${base}/logos/${row.id}.png` : row.logo_url;
          items.push({
            id: row.id, name: row.name, category: row.category, streamUrl, revision: row.revision,
            ...(row.number !== null && { number: row.number }),
            ...(logoUrl !== null && { logoUrl }),
          });
        }
        return { ok: true, value: { items, revision: revisionRow.data.revision } };
      } catch {
        return { ok: false, failure: unreachable };
      }
    },
  };
}

export type AdminChannelRepository = ReturnType<typeof createAdminChannelRepository>;
