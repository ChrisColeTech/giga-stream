import type { z } from "zod";
import { request } from "./api";
import {
  PlaylistDeletedSchema,
  PlaylistImportSchema,
  PlaylistListLenientSchema,
  PlaylistSchema,
  type AdminPlaylist,
  type PlaylistDeleted,
  type PlaylistImport,
  type PlaylistList,
} from "./schemas/playlist-schema";
import type { RecordInput } from "./service-types";

/** The Playlists routes (`43` section 3.2, `03` section 7.2c), REAL: `GET /api/playlists`, the two imports, `PATCH` and
 *  `DELETE /api/playlists/:id`. `importFile` posts the chosen file as one multipart `file` part; `create` is the
 *  web-address import and takes `{ url, name?, enabled? }`. Both answer the playlist, whether it is new, and what the
 *  import did. A web playlist's answer carries its address in full (`url`) and its `host`. `422 playlist.invalid` names its field (`url` or `file`), `409 playlist.taken` a name or address already
 *  held. A patch takes `name`, `enabled`, and for a web playlist a replacement `url`. `remove` answers
 *  `{ id, deletedChannels, deletedJobs }`. The list is read row by row: an unreadable row is dropped and counted. A
 *  write answer that does not parse is `backend.bad_response`. */
export interface PlaylistsService {
  list: () => Promise<PlaylistList>;
  create: (input: RecordInput) => Promise<PlaylistImport>;
  importFile: (file: File) => Promise<PlaylistImport>;
  update: (id: number, patch: RecordInput) => Promise<AdminPlaylist>;
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

/** The wire answer reduced to what the flows hold: the playlist without the import's extra keys. */
const imported = (answer: z.infer<typeof PlaylistImportSchema>): PlaylistImport => ({
  playlist: PlaylistSchema.parse(answer),
  created: answer.created,
  imported: answer.imported,
});

async function importFile(file: File): Promise<PlaylistImport> {
  const form = new FormData();
  form.append("file", file, file.name);
  return imported(await request("/api/playlists/import", PlaylistImportSchema, { method: "POST", form, area: "Playlist" }));
}

export const playlists: PlaylistsService = {
  list,
  create: async (input) =>
    imported(await request("/api/playlists", PlaylistImportSchema, { method: "POST", body: input, area: "Playlist" })),
  importFile,
  update: (id, patch) => request(path(id), PlaylistSchema, { method: "PATCH", body: patch, area: "Playlist" }),
  remove: (id) => request(path(id), PlaylistDeletedSchema, { method: "DELETE", area: "Playlist" }),
};
