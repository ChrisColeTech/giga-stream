import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";

import { CATEGORIES, MODES, VARIANT_NAMES } from "../constants/media.ts";
import type { Channel } from "../types/channel.ts";

const ChannelRow = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(CATEGORIES),
  number: z.number().int(),
  mode: z.enum(MODES),
  captions: z.number().int(),
  variants: z.string(),
  folder: z.string().nullable(),
  created_at: z.number().int(),
  updated_at: z.number().int(),
});
const Variants = z.array(z.enum(VARIANT_NAMES));
const PathRow = z.object({ path: z.string() });

const COLUMNS = "id, name, category, number, mode, captions, variants, folder, created_at, updated_at";

/** The channels table and each channel's listed videos. Channels are ordered by number. */
export function createChannelRepository(db: DatabaseSync) {
  const all = db.prepare(`SELECT ${COLUMNS} FROM channels ORDER BY number`);
  const one = db.prepare(`SELECT ${COLUMNS} FROM channels WHERE id = ?`);
  const byNumber = db.prepare("SELECT id FROM channels WHERE number = ?");
  const videosOf = db.prepare("SELECT path FROM channel_videos WHERE channel_id = ? ORDER BY position");
  const insert = db.prepare(`INSERT INTO channels (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const update = db.prepare(`
    UPDATE channels SET name = ?, category = ?, number = ?, mode = ?, captions = ?, variants = ?, folder = ?,
      updated_at = ? WHERE id = ?`);
  const clearVideos = db.prepare("DELETE FROM channel_videos WHERE channel_id = ?");
  const addVideo = db.prepare("INSERT INTO channel_videos (channel_id, position, path) VALUES (?, ?, ?)");
  const remove = db.prepare("DELETE FROM channels WHERE id = ?");

  function toChannel(row: unknown): Channel {
    const r = ChannelRow.parse(row);
    const videos = videosOf.all(r.id).map((video) => PathRow.parse(video).path);
    return {
      id: r.id,
      name: r.name,
      category: r.category,
      number: r.number,
      mode: r.mode,
      captions: r.captions === 1,
      variants: Variants.parse(JSON.parse(r.variants)),
      ...(r.folder !== null && { folder: r.folder }),
      ...(videos.length > 0 && { videos }),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  function writeVideos(c: Channel): void {
    clearVideos.run(c.id);
    (c.videos ?? []).forEach((file, position) => addVideo.run(c.id, position, file));
  }

  return {
    list: (): Channel[] => all.all().map(toChannel),
    find(id: string): Channel | undefined {
      const row = one.get(id);
      return row === undefined ? undefined : toChannel(row);
    },
    /** The id of the channel with this number, if any. */
    numberHolder(number: number): string | undefined {
      const row = byNumber.get(number);
      return row === undefined ? undefined : z.object({ id: z.string() }).parse(row).id;
    },
    insert(c: Channel): void {
      const variants = JSON.stringify(c.variants);
      insert.run(c.id, c.name, c.category, c.number, c.mode, c.captions ? 1 : 0, variants, c.folder ?? null,
        c.createdAt, c.updatedAt);
      writeVideos(c);
    },
    update(c: Channel): void {
      update.run(c.name, c.category, c.number, c.mode, c.captions ? 1 : 0, JSON.stringify(c.variants),
        c.folder ?? null, c.updatedAt, c.id);
      writeVideos(c);
    },
    remove(id: string): boolean {
      return Number(remove.run(id).changes) > 0;
    },
  };
}

export type ChannelRepository = ReturnType<typeof createChannelRepository>;
