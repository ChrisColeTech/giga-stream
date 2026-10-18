import type { VariantName } from "../constants/live-media.js";
import type { ChannelState, LiveMode, PlaylistEntry } from "./live-stream.js";

export type ChannelKind = "stream" | "live";

/**
 * A channel as the public reads answer it (docs/03 section 7.2): the shape the fileserver reads. A live
 * row's `streamUrl` and `logoUrl` are built from the caller's origin at read time (docs/26 decision D3).
 */
export interface BackendChannel {
  id: string;
  name: string;
  category: string;
  number?: string;
  logoUrl?: string;
  streamUrl: string;
  kind: ChannelKind;
  tvgId?: string;          // the playlist's tvg-id; the playlist sync's update key (docs/03 section 7.2c)
  source?: string;         // derived from the parent playlist (its host, or its file name), never stored (7.2c)
  /** A stream row's cached logo: absolute from the request origin on a public read (docs/46 D.1); the admin's is relative. */
  cachedLogoUrl?: string;
  revision: number;
}

export interface ChannelList {
  items: BackendChannel[];
  revision: number;
}

/** What a live channel is doing now (docs/10 section 3.1). */
export interface LiveStatus {
  state: ChannelState;
  /** Why the channel is `failed`, in one sentence. */
  problem?: string;
  fault: string | null;
  renditions: string[];
  playlist: PlaylistEntry[];
  nowPlaying: { index: number; name: string } | null;
}

/** A live channel's saved settings and source, as the admin sees them. */
export interface LiveSettingsView {
  mode: LiveMode;
  captions: boolean;
  variants: VariantName[];
  folder?: string;
  videos?: string[];
}

export interface StreamAdminChannel extends BackendChannel {
  kind: "stream";
  enabled: boolean;
  /** `enabled` and (no playlist, or the playlist is enabled): what a public reader sees (docs/43 section 3.1). */
  published: boolean;
  /** The fields an admin edited on a synced row; absent when none. */
  editedFields?: string[];
  playlistId?: number;
  playlistName?: string;
  /** The sync's verdict on this row's own stream address; absent = not checked (docs/03 section 7.2c). */
  status?: "online" | "offline";
  checkedAt?: number;
  /** The relative `/logos/c/<file>` of the cached copy; `logoUrl` stays the source address. */
  cachedLogoUrl?: string;
}

export interface LiveAdminChannel extends BackendChannel, LiveSettingsView, LiveStatus {
  kind: "live";
  enabled: boolean;
  published: boolean;
}

/** The admin's full view of a channel (docs/26 section 3.3): the public fields plus a live row's engine state. */
export type AdminChannel = StreamAdminChannel | LiveAdminChannel;

export interface AdminChannelList {
  items: AdminChannel[];
  revision: number;
}

/** What the store holds for every row. */
interface RecordCore {
  id: string;
  name: string;
  category: string;
  number: string | null;
  logoUrl: string | null;
  revision: number;
  /** A disabled row stays in the admin's lists and is left out of every public read; no sync changes it. */
  enabled: boolean;
  /** Derived by the read, never written: `enabled` and (no parent playlist, or the playlist is enabled). */
  published: boolean;
}

/** A live row's own columns: its encoding and exactly one of a folder or the ordered videos. */
export interface LiveSettings {
  mode: LiveMode;
  captions: boolean;
  variants: VariantName[];
  folder: string | null;
  videos: string[];
}

export interface StreamRecord extends RecordCore {
  kind: "stream";
  streamUrl: string;
  tvgId: string | null;
  /** Derived by the read from the parent playlist (its host, or its file name); never written. */
  source: string | null;
  /** The parent playlist's name; derived by the read, never written. */
  playlistName: string | null;
  /** The playlist's own name for the entry (a synced row), kept apart from `name` so a rename keeps the match. */
  syncName: string | null;
  /** The parent playlist, a foreign key with cascade; null on a hand-made row. */
  playlistId: number | null;
  /** The sync-owned columns: written only by the sync's targeted statements, never by `update` (docs/43 section 3.1). */
  status: "online" | "offline" | null;
  checkedAt: number | null;
  logoFile: string | null;
  logoCheckedAt: number | null;
  /** The fields an admin edited on a synced row: a sync never overwrites them (docs/26 section 3.10). */
  editedFields: string[];
}

export interface LiveRecord extends RecordCore {
  kind: "live";
  live: LiveSettings;
}

/** A row as the store reads and writes it, discriminated by `kind`. */
export type ChannelRecord = StreamRecord | LiveRecord;

/** What a stream row has before any playlist or sync touched it: no parent, no derived names, no verdict. */
export const NOT_SYNCED = {
  source: null,
  playlistName: null,
  playlistId: null,
  syncName: null,
  status: null,
  checkedAt: null,
  logoFile: null,
  logoCheckedAt: null,
} as const;
