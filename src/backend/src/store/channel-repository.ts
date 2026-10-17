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
  source: z.string().nullable(),
  stream_url: z.string().nullable(),
  revision: z.number().int(),
  kind: z.enum(["stream", "live"]),
  live_mode: z.enum(LIVE_MODES).nullable(),
  live_captions: z.number().int().nullable(),
  live_variants: z.string().nullable(),
  live_folder: z.string().nullable(),
  edited_fields: z.string().nullable(),
  sync_name: z.string().nullable(),
});
const editedOf = (json: string | null): string[] => {
  const parsed = json === null ? undefined : z.array(z.string()).safeParse(JSON.parse(json));
  return parsed?.success ? parsed.data : [];
};
const Variants = z.array(z.enum(VARIANT_NAMES));
const PathRow = z.object({ path: z.string() });
const IdRow = z.object({ id: z.string() });
const CountRow = z.object({ n: z.number() });

const COLUMNS = `id, name, category, number, logo_url, tvg_id, source, stream_url, revision, kind,
  live_mode, live_captions, live_variants, live_folder, edited_fields, sync_name`;

/**
 * The channels table and a live row's listed videos. Ordered by number then name (docs/03 section 7.2):
 * numbered channels first, by their numeric value, then the rest by name.
 */
export function createChannelRepository(db: DatabaseSync) {
  const all = db.prepare(`
    SELECT ${COLUMNS} FROM channels
    ORDER BY number IS NULL, CAST(number AS INTEGER), number, name COLLATE NOCASE, id`);
  const one = db.prepare(`SELECT ${COLUMNS} FROM channels WHERE id = ?`);
  const count = db.prepare("SELECT COUNT(*) AS n FROM channels");
  const countLive = db.prepare("SELECT COUNT(*) AS n FROM channels WHERE kind = 'live'");
  const liveByNumber = db.prepare("SELECT id FROM channels WHERE kind = 'live' AND number = ?");
  const videosOf = db.prepare("SELECT path FROM channel_videos WHERE channel_id = ? ORDER BY position");
  const insert = db.prepare(`
    INSERT INTO channels (${COLUMNS}, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const update = db.prepare(`
    UPDATE channels
    SET name = ?, category = ?, number = ?, logo_url = ?, tvg_id = ?, source = ?, stream_url = ?, revision = ?,
      live_mode = ?, live_captions = ?, live_variants = ?, live_folder = ?, edited_fields = ?, sync_name = ?
    WHERE id = ?`);
  const clearVideos = db.prepare("DELETE FROM channel_videos WHERE channel_id = ?");
  const addVideo = db.prepare("INSERT INTO channel_videos (channel_id, position, path) VALUES (?, ?, ?)");
  const remove = db.prepare("DELETE FROM channels WHERE id = ?");

  function toRecord(row: unknown): ChannelRecord {
    const r = ChannelRow.parse(row);
    const core = { id: r.id, name: r.name, category: r.category, number: r.number, logoUrl: r.logo_url, revision: r.revision };
    if (r.kind === "stream") {
      if (r.stream_url === null) throw new Error(`channel ${r.id} is a stream row without an address`);
      const stream: StreamRecord = { ...core, kind: "stream", streamUrl: r.stream_url, tvgId: r.tvg_id, source: r.source,
        syncName: r.sync_name, editedFields: editedOf(r.edited_fields) };
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
  }

  /** The live columns of a record, as the statements bind them; a stream row binds nulls. */
  function liveColumns(c: ChannelRecord): [string | null, number | null, string | null, string | null] {
    if (c.kind === "stream") return [null, null, null, null];
    return [c.live.mode, c.live.captions ? 1 : 0, JSON.stringify(c.live.variants), c.live.folder];
  }

  /** A stream row's sync bookkeeping as the statements bind it: edited fields (null = none) and sync name. */
  function syncColumns(c: StreamRecord | undefined): [string | null, string | null] {
    return [c && c.editedFields.length > 0 ? JSON.stringify(c.editedFields) : null, c?.syncName ?? null];
  }

  function writeVideos(c: ChannelRecord): void {
    clearVideos.run(c.id);
    if (c.kind === "live") c.live.videos.forEach((file, position) => addVideo.run(c.id, position, file));
  }

  return {
    list: (): ChannelRecord[] => all.all().map(toRecord),
    /** The stream rows the playlist sync owns (docs/03 section 7.2c): the ones that carry a `source`. */
    listSynced: (): StreamRecord[] =>
      all.all().map(toRecord).filter((c): c is StreamRecord => c.kind === "stream" && c.source !== null),
    find(id: string): ChannelRecord | undefined {
      const row = one.get(id);
      return row === undefined ? undefined : toRecord(row);
    },
    isEmpty: (): boolean => CountRow.parse(count.get()).n === 0,
    countLive: (): number => CountRow.parse(countLive.get()).n,
    /** The id of the live row with this number, if any (a live number is unique among live rows). */
    liveNumberHolder(number: string): string | undefined {
      const row = liveByNumber.get(number);
      return row === undefined ? undefined : IdRow.parse(row).id;
    },
    insert(c: ChannelRecord, createdAt: number): void {
      const stream = c.kind === "stream" ? c : undefined;
      insert.run(
        c.id, c.name, c.category, c.number, c.logoUrl, stream?.tvgId ?? null, stream?.source ?? null,
        stream?.streamUrl ?? null, c.revision, c.kind, ...liveColumns(c), ...syncColumns(stream), createdAt,
      );
      writeVideos(c);
    },
    update(c: ChannelRecord): void {
      const stream = c.kind === "stream" ? c : undefined;
      update.run(
        c.name, c.category, c.number, c.logoUrl, stream?.tvgId ?? null, stream?.source ?? null,
        stream?.streamUrl ?? null, c.revision, ...liveColumns(c), ...syncColumns(stream), c.id,
      );
      writeVideos(c);
    },
    remove(id: string): boolean {
      return Number(remove.run(id).changes) > 0;
    },
  };
}

export type ChannelRepository = ReturnType<typeof createChannelRepository>;
