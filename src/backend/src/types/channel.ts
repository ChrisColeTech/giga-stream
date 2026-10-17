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
  source?: string;         // the playlist host that created the row; sync-owned rows only (section 7.2c)
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
  /** The fields an admin edited on a synced row; absent when none. */
  editedFields?: string[];
}

export interface LiveAdminChannel extends BackendChannel, LiveSettingsView, LiveStatus {
  kind: "live";
  enabled: boolean;
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
  source: string | null;
  /** The playlist's own name for the entry (a synced row), kept apart from `name` so a rename keeps the match. */
  syncName: string | null;
  /** The playlist record that created or last updated the row; `source` stays that playlist's host. */
  playlistId: number | null;
  /** The fields an admin edited on a synced row: a sync never overwrites them (docs/26 section 3.10). */
  editedFields: string[];
}

export interface LiveRecord extends RecordCore {
  kind: "live";
  live: LiveSettings;
}

/** A row as the store reads and writes it, discriminated by `kind`. */
export type ChannelRecord = StreamRecord | LiveRecord;
