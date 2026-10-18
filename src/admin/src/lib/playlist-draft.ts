import { ADDRESS_REQUIRED, NAME_LONG, NAME_MAX, REPLACE_REASON } from "@/constants/playlist-copy";
import type { AdminPlaylist } from "@/services/schemas/playlist-schema";
import { httpsAddress } from "./field-checks";

/* The Playlists forms' values (`38` sections 3.2 and 3.3), pure. The address is a secret: a draft holds the value only
 * while the person types it, it is never filled from a record (no answer carries it), and a save clears it. The
 * workspace's Address is LOCKED (the masked form shows) until `Replace` unlocks it as an empty field; an unlocked,
 * empty address is not a change. Masking is display only: the stored address is never altered unless a new one is sent. */

export interface NewPlaylistDraft {
  /** Optional: left empty, the backend names the playlist after its host. */
  readonly name: string;
  readonly address: string;
}

export const EMPTY_NEW_PLAYLIST: NewPlaylistDraft = { name: "", address: "" };

export const sameNewPlaylist = (a: NewPlaylistDraft, b: NewPlaylistDraft): boolean =>
  a.name === b.name && a.address === b.address;

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

/** Why `Replace` is disabled: once unlocked, it waits for the value and the Save. */
export const replaceReason = (draft: PlaylistDraft): string | undefined =>
  draft.replacing ? REPLACE_REASON : undefined;

export const nameLength = (value: string): string | null => (value.trim().length > NAME_MAX ? NAME_LONG : null);

/** Why `Create` is disabled, or undefined. Name never gates it; busy and unreachable come after the Address. */
export function createReason(draft: NewPlaylistDraft, busy: string | undefined): string | undefined {
  return draft.address.trim() === "" ? ADDRESS_REQUIRED : busy;
}

export type PlaylistField = "name" | "address" | "enabled";

export interface PlaylistRefusal {
  readonly field: PlaylistField;
  readonly sentence: string;
}

/** The first value a form refuses when it is sent, in the form's order, or null: the name's length, then the address
 *  rule (`https`; the backend checks the rest and names `address` when it refuses). */
export function firstRefusal(name: string, address: string | null): PlaylistRefusal | null {
  const tooLong = nameLength(name);
  if (tooLong !== null) return { field: "name", sentence: tooLong };
  const bad = address === null ? null : httpsAddress("Address", address);
  return bad === null ? null : { field: "address", sentence: bad };
}
