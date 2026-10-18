import {
  ADDRESS_REQUIRED, FILE_REQUIRED, NAME_LONG, NAME_MAX, REPLACE_FILE_REASON, REPLACE_REASON,
} from "@/constants/playlist-copy";
import type { AdminPlaylist } from "@/services/schemas/playlist-schema";
import { httpsAddress } from "./field-checks";

/* The Playlists forms' values (`38` sections 3.2 and 3.3, `43` section 4.1), pure. The address is a secret: a draft
 * holds the value only while the person types it, it is never filled from a record (no answer carries it), and a save
 * clears it. The workspace's Address is LOCKED (the masked form shows) until `Replace` unlocks it as an empty field; an
 * unlocked, empty address is not a change. Masking is display only: the stored address is never altered unless a new
 * one is sent. */

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
  /** `Replace` was pressed: the Address row is an empty password field instead of the masked form. */
  readonly replacing: boolean;
  /** The new address being typed; empty while locked. */
  readonly address: string;
}

export const draftOf = (playlist: AdminPlaylist): PlaylistDraft => ({
  name: playlist.name,
  enabled: playlist.enabled,
  replacing: false,
  address: "",
});

/** The address a save would send: only an unlocked field with something typed in it. */
export const newAddressOf = (draft: PlaylistDraft): string | null => {
  const text = draft.address.trim();
  return draft.replacing && text !== "" ? text : null;
};

/** Value equality: the lock itself is not a value, so an unlocked, empty Address leaves the form clean. */
export const samePlaylistDraft = (a: PlaylistDraft, b: PlaylistDraft): boolean =>
  a.name === b.name && a.enabled === b.enabled && newAddressOf(a) === newAddressOf(b);

/** `Replace`: the field unlocks, empty, never prefilled. */
export const startReplace = (draft: PlaylistDraft): PlaylistDraft => ({ ...draft, replacing: true, address: "" });

/** Why `Replace` is disabled: a file playlist has no address to replace; once unlocked, it waits for the value. */
export function replaceReason(draft: PlaylistDraft, playlist: AdminPlaylist): string | undefined {
  if (playlist.kind === "file") return REPLACE_FILE_REASON;
  return draft.replacing ? REPLACE_REASON : undefined;
}

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
 *  rule (`https`; the backend checks the rest and names `url` when it refuses). */
export function firstRefusal(name: string, address: string | null): PlaylistRefusal | null {
  const tooLong = nameLength(name);
  if (tooLong !== null) return { field: "name", sentence: tooLong };
  const bad = address === null ? null : httpsAddress("Address", address);
  return bad === null ? null : { field: "address", sentence: bad };
}
