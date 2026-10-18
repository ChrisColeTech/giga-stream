import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";

import type { ChannelRecord, StreamRecord } from "../types/channel.js";
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
export function createChannelRepository(db: DatabaseSync) {
  const toRecord = createRowReader(db);
  const select = `SELECT ${CHANNEL_SELECT} FROM ${CHANNEL_FROM}`;
  const all = db.prepare(`${select} ${CHANNEL_ORDER}`);
  const one = db.prepare(`${select} WHERE c.id = ?`);
  const ofPlaylist = db.prepare(`${select} WHERE c.playlist_id = ? ORDER BY c.id`);
  const count = db.prepare("SELECT COUNT(*) AS n FROM channels");
  const countLive = db.prepare("SELECT COUNT(*) AS n FROM channels WHERE kind = 'live'");
  const liveByNumber = db.prepare("SELECT id FROM channels WHERE kind = 'live' AND number = ?");
  const liveIds = db.prepare("SELECT id FROM channels WHERE kind = 'live' ORDER BY id");
  const insert = db.prepare(`
    INSERT INTO channels (id, name, category, number, logo_url, tvg_id, stream_url, revision, kind,
      live_mode, live_captions, live_variants, live_folder, edited_fields, sync_name, playlist_id, enabled, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const update = db.prepare(`
    UPDATE channels
    SET name = ?, category = ?, number = ?, logo_url = ?, tvg_id = ?, stream_url = ?, revision = ?,
      live_mode = ?, live_captions = ?, live_variants = ?, live_folder = ?, edited_fields = ?, sync_name = ?,
      playlist_id = ?, enabled = ?,
      status = CASE WHEN stream_url IS ? THEN status ELSE NULL END,
      checked_at = CASE WHEN stream_url IS ? THEN checked_at ELSE NULL END,
      logo_file = CASE WHEN logo_url IS ? THEN logo_file ELSE NULL END,
      logo_checked_at = CASE WHEN logo_url IS ? THEN logo_checked_at ELSE NULL END
    WHERE id = ?`);
  const setVerdict = db.prepare("UPDATE channels SET status = ?, checked_at = ? WHERE id = ? AND kind = 'stream'");
  const clearVideos =db.prepare("DELETE FROM channel_videos WHERE channel_id = ?");
  const addVideo = db.prepare("INSERT INTO channel_videos (channel_id, position, path) VALUES (?, ?, ?)");
  const remove = db.prepare("DELETE FROM channels WHERE id = ?");
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

  function writeVideos(c: ChannelRecord): void {
    clearVideos.run(c.id);
    if (c.kind === "live") c.live.videos.forEach((file, position) => addVideo.run(c.id, position, file));
  }

  return {
    list: (): ChannelRecord[] => all.all().map(toRecord),
    /** One page in a total, stable order, and the count the filters keep (docs/41 section 3.1). */
    page: createChannelPage(db, toRecord),
    /** The ids of the live rows (a handful): the paged read asks the engine for their state. */
    liveIds: (): string[] => liveIds.all().map((row) => IdRow.parse(row).id),
    /** Every row of one playlist, in id order: the pool the import's planner matches against (docs/43 section 3.6). */
    listOfPlaylist: (playlistId: number): StreamRecord[] =>
      ofPlaylist.all(playlistId).map(toRecord).filter((c): c is StreamRecord => c.kind === "stream"),
    find(id: string): ChannelRecord | undefined {
      const row = one.get(id);
      return row === undefined ? undefined : toRecord(row);
    },
    isEmpty: (): boolean => CountRow.parse(count.get()).n === 0,
    countLive: (): number => CountRow.parse(countLive.get()).n,
    /** Channels, enabled, live and dead per playlist, for the playlist views. */
    countsByPlaylist: stats.byPlaylist,
    /** The id of the live row with this number, if any (a live number is unique among live rows). */
    liveNumberHolder(number: string): string | undefined {
      const row = liveByNumber.get(number);
      return row === undefined ? undefined : IdRow.parse(row).id;
    },
    insert(c: ChannelRecord, createdAt: number): void {
      const stream = c.kind === "stream" ? c : undefined;
      insert.run(
        c.id, c.name, c.category, c.number, c.logoUrl, stream?.tvgId ?? null, stream?.streamUrl ?? null, c.revision,
        c.kind, ...liveColumns(c), ...syncColumns(stream), c.enabled ? 1 : 0, createdAt,
      );
      writeVideos(c);
    },
    update(c: ChannelRecord): void {
      const stream = c.kind === "stream" ? c : undefined;
      const [edited, syncName, playlistId] = syncColumns(stream);
      const streamUrl = stream?.streamUrl ?? null;
      update.run(
        c.name, c.category, c.number, c.logoUrl, stream?.tvgId ?? null, streamUrl, c.revision, ...liveColumns(c),
        edited, syncName, playlistId, c.enabled ? 1 : 0, streamUrl, streamUrl, c.logoUrl, c.logoUrl, c.id,
      );
      writeVideos(c);
    },
    /** A hand-set verdict on one stream row's own address: `status` and `checked_at` only, no revision (admin-only). */
    setVerdict: (id: string, status: "live" | "dead", at: number): boolean =>
      Number(setVerdict.run(status, at, id).changes) > 0,
    remove(id: string): boolean {
      return Number(remove.run(id).changes) > 0;
    },
  };
}

export type ChannelRepository = ReturnType<typeof createChannelRepository>;
