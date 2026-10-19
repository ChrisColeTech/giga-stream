import type { AdminPlaylist } from "@/services/schemas/playlist-schema";
import { newAddressOf, type NewPlaylistDraft, type PlaylistDraft } from "./playlist-draft";

/* The request bodies of the Playlists routes (`43` section 3.2), pure. The address is passed through trimmed. A file import has no JSON body: the file goes as one multipart part (`services/playlists.ts`). */

/* Type aliases, not interfaces: a request body is a plain record (`RecordInput`), which an interface cannot be. */
export type PlaylistUrlBody = {
  readonly name: string;
  readonly url: string;
};

/** `POST /api/playlists`, the web-address import: the trimmed address alone. The playlist is named after its host. */
export const urlBody = (draft: NewPlaylistDraft): PlaylistUrlBody => ({
  name: draft.name.trim(),
  url: draft.address.trim(),
});

export type PlaylistPatch = {
  readonly name?: string;
  readonly enabled?: boolean;
  readonly url?: string;
};

/** `PATCH /api/playlists/:id`: only what differs from the saved playlist. A name emptied in the workspace is no change
 *  (the playlist keeps the name it has); an address only when it differs from the saved one. */
export function changedFields(saved: AdminPlaylist, draft: PlaylistDraft): PlaylistPatch {
  const typed = draft.name.trim();
  const url = newAddressOf(saved, draft);
  return {
    ...(typed !== "" && typed !== saved.name && { name: typed }),
    ...(draft.enabled !== saved.enabled && { enabled: draft.enabled }),
    ...(url !== null && { url }),
  };
}

export const isEmptyPatch = (patch: PlaylistPatch): boolean => Object.keys(patch).length === 0;
