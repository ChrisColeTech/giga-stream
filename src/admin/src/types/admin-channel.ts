/* The backend's own channel response shapes (`29` section 5, copied from `src/backend/src/types`), so the wiring wave
 * replaces only the source of the data and never the shape. `GET /api/admin-channels` answers `{ items, revision }`. */

export type ChannelState = "preparing" | "starting" | "live" | "restarting" | "stopped" | "failed";

export type Variant = "360p" | "720p" | "1080p";

export type LiveMode = "loop" | "encode";

/** The six categories a live channel picks from; a stream channel's category is free text. */
export type LiveCategory = "News" | "Sports" | "Music" | "Kids" | "Movies" | "Entertainment";

export interface BackendChannel {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly logoUrl?: string;
  /** A live row's is `<caller origin>/live/<id>/master.m3u8`; a stream row's is the address its players load. */
  readonly streamUrl: string;
  readonly kind: "stream" | "live";
  readonly tvgId?: string;
  /** Derived by the backend from the parent playlist (its host, or its file name); absent on a hand-made row. */
  readonly source?: string;
  readonly revision: number;
}

export interface StreamAdminChannel extends BackendChannel {
  readonly kind: "stream";
  readonly enabled: boolean;
  /** `enabled` and (no playlist, or the playlist is enabled): what a player reads (`43` section 3.1). */
  readonly published: boolean;
  /** The fields an admin edited on a synced row; the sync keeps them. */
  readonly editedFields?: readonly string[];
  /** The parent playlist; absent on a hand-made row. */
  readonly playlistId?: number;
  readonly playlistName?: string;
  /** The sync's verdict on the row's own stream address; absent until it is checked. */
  readonly status?: "live" | "dead";
  readonly checkedAt?: number;
  /** The relative `/logos/c/<file>` of the cached copy; `logoUrl` stays the source address. */
  readonly cachedLogoUrl?: string;
}

export interface PlaylistEntry {
  readonly name: string;
  readonly durationMs: number;
}

export interface LiveAdminChannel extends BackendChannel {
  readonly kind: "live";
  readonly enabled: boolean;
  readonly published: boolean;
  readonly mode: LiveMode;
  readonly captions: boolean;
  readonly variants: readonly Variant[];
  /** Exactly one of `folder` and `videos`. */
  readonly folder?: string;
  readonly videos?: readonly string[];
  readonly state: ChannelState;
  readonly problem?: string;
  readonly renditions: readonly string[];
  readonly playlist: readonly PlaylistEntry[];
  readonly nowPlaying: { readonly index: number; readonly name: string } | null;
}

export type AdminChannel = StreamAdminChannel | LiveAdminChannel;
