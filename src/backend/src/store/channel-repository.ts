import { z } from "zod";

import type { ChannelRecord, StreamRecord } from "../types/channel.js";
import type { Database } from "./database.js";
import { CHANNEL_FROM, CHANNEL_ORDER, CHANNEL_SELECT } from "./channel-columns.js";
import { createChannelPage } from "./channel-page.js";
import { createRowReader } from "./channel-rows.js";
import { createChannelStats } from "./channel-stats.js";

const IdRow = z.object({ id: z.string() });
const CountRow = z.object({ n: z.number() });

/**
 * The channels table and a live row's listed videos. Ordered by number then name (docs/03 section 7.2):
 * numbered channels first, by their numeric value, then the rest by name. A read joins the parent playlist for the
 * derived `source`, `playlistName` and `published` (docs/43 section 3.1). `update` never writes the sync-owned
 * columns (`status`, `checkedAt`, `logoFile`, `logoCheckedAt`); it only resets the ones that depend on an address
 * it changes, in the same statement.
 */
export function createChannelRepository(db: Database) {
  const toRecord = createRowReader(db);
  const select = `SELECT ${CHANNEL_SELECT} FROM ${CHANNEL_FROM}`;
  const SQL = {
    all: `${select} ${CHANNEL_ORDER}`,
    one: `${select} WHERE c.id = ?`,
    ofPlaylist: `${select} WHERE c.playlist_id = ? ORDER BY c.id`,
    count: "SELECT COUNT(*) AS n FROM channels",
    countLive: "SELECT COUNT(*) AS n FROM channels WHERE kind = 'live'",
    liveByNumber: "SELECT id FROM channels WHERE kind = 'live' AND number = ?",
    liveIds: "SELECT id FROM channels WHERE kind = 'live' ORDER BY id",
    insert: `
      INSERT INTO channels (id, name, category, number, logo_url, tvg_id, stream_url, revision, kind,
        live_mode, live_captions, live_variants, live_folder, edited_fields, sync_name, playlist_id, enabled, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    update: `
      UPDATE channels
      SET name = ?, category = ?, number = ?, logo_url = ?, tvg_id = ?, stream_url = ?, revision = ?,
        live_mode = ?, live_captions = ?, live_variants = ?, live_folder = ?, edited_fields = ?, sync_name = ?,
        playlist_id = ?, enabled = ?,
        status = CASE WHEN stream_url IS ? THEN status ELSE NULL END,
        checked_at = CASE WHEN stream_url IS ? THEN checked_at ELSE NULL END,
        logo_file = CASE WHEN logo_url IS ? THEN logo_file ELSE NULL END,
        logo_checked_at = CASE WHEN logo_url IS ? THEN logo_checked_at ELSE NULL END
      WHERE id = ?`,
    setVerdict: "UPDATE channels SET status = ?, checked_at = ? WHERE id = ? AND kind = 'stream'",
    clearVideos: "DELETE FROM channel_videos WHERE channel_id = ?",
    addVideo: "INSERT INTO channel_videos (channel_id, position, path) VALUES (?, ?, ?)",
    remove: "DELETE FROM channels WHERE id = ?",
  };
  const stats = createChannelStats(db);

  /** The live columns of a record, as the statements bind them; a stream row binds nulls. */
  function liveColumns(c: ChannelRecord): [string | null, number | null, string | null, string | null] {
    if (c.kind === "stream") return [null, null, null, null];
    return [c.live.mode, c.live.captions ? 1 : 0, JSON.stringify(c.live.variants), c.live.folder];
  }

  /** A stream row's sync bookkeeping as the statements bind it: edited fields (null = none), sync name, playlist. */
  function syncColumns(c: StreamRecord | undefined): [string | null, string | null, number | null] {
    const edited = c && c.editedFields.length > 0 ? JSON.stringify(c.editedFields) : null;
    return [edited, c?.syncName ?? null, c?.playlistId ?? null];
  }

  async function writeVideos(c: ChannelRecord): Promise<void> {
    await db.execute({ sql: SQL.clearVideos, args: [c.id] });
    if (c.kind === "live") {
      for (const [position, file] of c.live.videos.entries()) {
        await db.execute({ sql: SQL.addVideo, args: [c.id, position, file] });
      }
    }
  }

  return {
    list: async (): Promise<ChannelRecord[]> =>
      Promise.all((await db.execute(SQL.all)).rows.map(toRecord)),
    /** One page in a total, stable order, and the count the filters keep (docs/41 section 3.1). */
    page: createChannelPage(db, toRecord),
    /** The ids of the live rows (a handful): the paged read asks the engine for their state. */
    liveIds: async (): Promise<string[]> =>
      (await db.execute(SQL.liveIds)).rows.map((row) => IdRow.parse(row).id),
    /** Every row of one playlist, in id order: the pool the import's planner matches against (docs/43 section 3.6). */
    listOfPlaylist: async (playlistId: number): Promise<StreamRecord[]> => {
      const records = await Promise.all(
        (await db.execute({ sql: SQL.ofPlaylist, args: [playlistId] })).rows.map(toRecord),
      );
      return records.filter((c): c is StreamRecord => c.kind === "stream");
    },
    find: async (id: string): Promise<ChannelRecord | undefined> => {
      const row = (await db.execute({ sql: SQL.one, args: [id] })).rows[0];
      return row === undefined ? undefined : toRecord(row);
    },
    isEmpty: async (): Promise<boolean> => CountRow.parse((await db.execute(SQL.count)).rows[0]).n === 0,
    countLive: async (): Promise<number> => CountRow.parse((await db.execute(SQL.countLive)).rows[0]).n,
    /** Channels, enabled, online and offline per playlist, for the playlist views. */
    countsByPlaylist: stats.byPlaylist,
    /** The id of the live row with this number, if any (a live number is unique among live rows). */
    liveNumberHolder: async (number: string): Promise<string | undefined> => {
      const row = (await db.execute({ sql: SQL.liveByNumber, args: [number] })).rows[0];
      return row === undefined ? undefined : IdRow.parse(row).id;
    },
    async insert(c: ChannelRecord, createdAt: number): Promise<void> {
      const stream = c.kind === "stream" ? c : undefined;
      await db.execute({
        sql: SQL.insert,
        args: [
          c.id, c.name, c.category, c.number, c.logoUrl, stream?.tvgId ?? null, stream?.streamUrl ?? null, c.revision,
          c.kind, ...liveColumns(c), ...syncColumns(stream), c.enabled ? 1 : 0, createdAt,
        ],
      });
      await writeVideos(c);
    },
    async update(c: ChannelRecord): Promise<void> {
      const stream = c.kind === "stream" ? c : undefined;
      const [edited, syncName, playlistId] = syncColumns(stream);
      const streamUrl = stream?.streamUrl ?? null;
      await db.execute({
        sql: SQL.update,
        args: [
          c.name, c.category, c.number, c.logoUrl, stream?.tvgId ?? null, streamUrl, c.revision, ...liveColumns(c),
          edited, syncName, playlistId, c.enabled ? 1 : 0, streamUrl, streamUrl, c.logoUrl, c.logoUrl, c.id,
        ],
      });
      await writeVideos(c);
    },
    /** A hand-set verdict on one stream row's own address: `status` and `checked_at` only, no revision (admin-only). */
    setVerdict: async (id: string, status: "online" | "offline", at: number): Promise<boolean> =>
      (await db.execute({ sql: SQL.setVerdict, args: [status, at, id] })).rowsAffected > 0,
    remove: async (id: string): Promise<boolean> =>
      (await db.execute({ sql: SQL.remove, args: [id] })).rowsAffected > 0,
  };
}

export type ChannelRepository = ReturnType<typeof createChannelRepository>;
