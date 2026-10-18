import type { AdminPlaylist } from "@/services/schemas/playlist-schema";
import { newAddressOf, type NewPlaylistDraft, type PlaylistDraft } from "./playlist-draft";

/* The request bodies of the Playlists routes (`38` section 3.1), pure. The address is passed through trimmed and goes
 * nowhere else. */

/* Type aliases, not interfaces: a request body is a plain record (`RecordInput`), which an interface cannot be. */
export type PlaylistCreateBody = {
  readonly name?: string;
  readonly address: string;
};

/** `POST /api/playlists`: the trimmed address, and the name only when one was typed (else the backend takes the host). */
export function createBody(draft: NewPlaylistDraft): PlaylistCreateBody {
  const name = draft.name.trim();
  return { address: draft.address.trim(), ...(name !== "" && { name }) };
}

export type PlaylistPatch = {
  readonly name?: string;
  readonly enabled?: boolean;
  readonly address?: string;
};

/** `PATCH /api/playlists/:id`: only what differs from the saved playlist. A name emptied in the workspace means what an
 *  empty Name means on create, the host; an address only when `Replace` unlocked the field and a value was typed. */
export function changedFields(saved: AdminPlaylist, draft: PlaylistDraft): PlaylistPatch {
  const typed = draft.name.trim();
  const name = typed === "" ? saved.host : typed;
  const address = newAddressOf(draft);
  return {
    ...(name !== saved.name && { name }),
    ...(draft.enabled !== saved.enabled && { enabled: draft.enabled }),
    ...(address !== null && { address }),
  };
}

export const isEmptyPatch = (patch: PlaylistPatch): boolean => Object.keys(patch).length === 0;
