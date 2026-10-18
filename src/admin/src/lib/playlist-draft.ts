import { ADDRESS_REQUIRED, FILE_REQUIRED, NAME_LONG, NAME_MAX } from "@/constants/playlist-copy";
import type { AdminPlaylist } from "@/services/schemas/playlist-schema";
import { webAddress } from "./field-checks";

/* The Playlists forms' values (`38` sections 3.2 and 3.3, `43` section 4.1), pure. The address is shown in full
 * (owner, 2026-10-18): the workspace's draft is filled from the record's `url` (a file playlist has none) and an
 * emptied address is not a change. */

export type ImportSource = "file" | "url";

/** `New playlist`: one source at a time. The chosen file is held whole until the import; the name is never typed here
 *  (the playlist is named after its file or its host, and renamed in the workspace). */
export interface NewPlaylistDraft {
  readonly source: ImportSource;
  readonly file: File | null;
  readonly address: string;
}

export const EMPTY_NEW_PLAYLIST: NewPlaylistDraft = { source: "file", file: null, address: "" };

export const sameNewPlaylist = (a: NewPlaylistDraft, b: NewPlaylistDraft): boolean =>
  a.source === b.source && a.file === b.file && a.address === b.address;

export interface PlaylistDraft {
  readonly name: string;
  readonly enabled: boolean;
  /** The web address as typed; empty for a file playlist, which has none. */
  readonly address: string;
}

export const draftOf = (playlist: AdminPlaylist): PlaylistDraft => ({
  name: playlist.name,
  enabled: playlist.enabled,
  address: playlist.url ?? "",
});

/** The address a save would send: a web playlist's typed address when it differs from the saved one, else null. */
export const newAddressOf = (saved: AdminPlaylist, draft: PlaylistDraft): string | null => {
  const text = draft.address.trim();
  return saved.kind === "url" && text !== "" && text !== saved.url ? text : null;
};

export const samePlaylistDraft = (a: PlaylistDraft, b: PlaylistDraft): boolean =>
  a.name === b.name && a.enabled === b.enabled && a.address === b.address;

export const nameLength = (value: string): string | null => (value.trim().length > NAME_MAX ? NAME_LONG : null);

/** Why `Import` is disabled, or undefined: the chosen source's missing value, then busy or unreachable. */
export function createReason(draft: NewPlaylistDraft, busy: string | undefined): string | undefined {
  if (draft.source === "file") return draft.file === null ? FILE_REQUIRED : busy;
  return draft.address.trim() === "" ? ADDRESS_REQUIRED : busy;
}

export type PlaylistField = "name" | "address" | "enabled" | "file";

export interface PlaylistRefusal {
  readonly field: PlaylistField;
  readonly sentence: string;
}

/** The first value a form refuses when it is sent, in the form's order, or null: the name's length, then the address
 *  rule (`http` or `https`, no credentials; the backend checks the rest and names `url` when it refuses). */
export function firstRefusal(name: string, address: string | null): PlaylistRefusal | null {
  const tooLong = nameLength(name);
  if (tooLong !== null) return { field: "name", sentence: tooLong };
  const bad = address === null ? null : webAddress("Address", address);
  return bad === null ? null : { field: "address", sentence: bad };
}
