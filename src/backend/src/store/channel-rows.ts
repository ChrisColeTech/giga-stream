import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";

import { LIVE_MODES, VARIANT_NAMES } from "../constants/live-media.js";
import type { ChannelRecord, LiveRecord, StreamRecord } from "../types/channel.js";

const ChannelRow = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  number: z.string().nullable(),
  logo_url: z.string().nullable(),
  tvg_id: z.string().nullable(),
  stream_url: z.string().nullable(),
  revision: z.number().int(),
  kind: z.enum(["stream", "live"]),
  live_mode: z.enum(LIVE_MODES).nullable(),
  live_captions: z.number().int().nullable(),
  live_variants: z.string().nullable(),
  live_folder: z.string().nullable(),
  edited_fields: z.string().nullable(),
  sync_name: z.string().nullable(),
  playlist_id: z.number().int().nullable(),
  enabled: z.number().int(),
  status: z.enum(["online", "offline"]).nullable(),
  checked_at: z.number().int().nullable(),
  logo_file: z.string().nullable(),
  logo_checked_at: z.number().int().nullable(),
  source: z.string().nullable(),
  playlist_name: z.string().nullable(),
  published: z.number().int(),
});
const PathRow = z.object({ path: z.string() });
const Variants = z.array(z.enum(VARIANT_NAMES));

const editedOf = (json: string | null): string[] => {
  const parsed = json === null ? undefined : z.array(z.string()).safeParse(JSON.parse(json));
  return parsed?.success ? parsed.data : [];
};

/** Turns a joined `CHANNEL_SELECT` row into a record; a live row also reads its listed videos. */
export function createRowReader(db: DatabaseSync): (row: unknown) => ChannelRecord {
  const videosOf = db.prepare("SELECT path FROM channel_videos WHERE channel_id = ? ORDER BY position");
  return (row) => {
    const r = ChannelRow.parse(row);
    const core = {
      id: r.id, name: r.name, category: r.category, number: r.number, logoUrl: r.logo_url, revision: r.revision,
      enabled: r.enabled === 1, published: r.published === 1,
    };
    if (r.kind === "stream") {
      if (r.stream_url === null) throw new Error(`channel ${r.id} is a stream row without an address`);
      const stream: StreamRecord = {
        ...core, kind: "stream", streamUrl: r.stream_url, tvgId: r.tvg_id, source: r.source, playlistName: r.playlist_name,
        syncName: r.sync_name, playlistId: r.playlist_id, editedFields: editedOf(r.edited_fields), status: r.status,
        checkedAt: r.checked_at, logoFile: r.logo_file, logoCheckedAt: r.logo_checked_at,
      };
      return stream;
    }
    if (r.live_mode === null || r.live_captions === null || r.live_variants === null) {
      throw new Error(`channel ${r.id} is a live row without its settings`);
    }
    const live: LiveRecord = {
      ...core,
      kind: "live",
      live: {
        mode: r.live_mode,
        captions: r.live_captions === 1,
        variants: Variants.parse(JSON.parse(r.live_variants)),
        folder: r.live_folder,
        videos: videosOf.all(r.id).map((video) => PathRow.parse(video).path),
      },
    };
    return live;
  };
}
