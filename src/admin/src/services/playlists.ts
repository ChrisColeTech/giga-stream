import { request } from "./api";
import {
  PlaylistDeletedSchema,
  PlaylistListLenientSchema,
  PlaylistSchema,
  type AdminPlaylist,
  type PlaylistDeleted,
  type PlaylistList,
} from "./schemas/playlist-schema";
import type { RecordService } from "./service-types";

/** The Playlists routes (`29` section 9.4, `38` section 3.1), REAL: `GET`, `POST /api/playlists`, `PATCH` and `DELETE
 *  /api/playlists/:id`. A create takes `{ name?, address, enabled? }` (the name defaults to the host); a patch any of
 *  them, an `address` replacing the stored one. The address is a secret: no answer carries it (only `host` and
 *  `masked`), and this module never reads one back. `422 playlist.invalid` names its field (`address`). `remove` is widened
 *  (additive) to answer `{ id, released }`, the number of channels kept as hand-made rows. The list is read row by row:
 *  an unreadable row is dropped and counted. A write answer that does not parse is `backend.bad_response`. */
export interface PlaylistsService extends RecordService<AdminPlaylist, number, PlaylistList> {
  remove: (id: number) => Promise<PlaylistDeleted>;
}

const path = (id: number): string => `/api/playlists/${encodeURIComponent(String(id))}`;

async function list(): Promise<PlaylistList> {
  const answer = await request("/api/playlists", PlaylistListLenientSchema, { area: "Playlist" });
  const items: AdminPlaylist[] = [];
  for (const row of answer.items) {
    const parsed = PlaylistSchema.safeParse(row);
    if (parsed.success) items.push(parsed.data);
  }
  return { items, unreadable: answer.items.length - items.length };
}

export const playlists: PlaylistsService = {
  list,
  create: (input) => request("/api/playlists", PlaylistSchema, { method: "POST", body: input, area: "Playlist" }),
  update: (id, patch) => request(path(id), PlaylistSchema, { method: "PATCH", body: patch, area: "Playlist" }),
  remove: (id) => request(path(id), PlaylistDeletedSchema, { method: "DELETE", area: "Playlist" }),
};
