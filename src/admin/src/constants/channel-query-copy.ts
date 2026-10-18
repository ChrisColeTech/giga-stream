import type {
  EnabledFilter, KindFilter, LiveStateFilter, OriginFilter, ChannelSortKey, StatusFilter,
} from "@/lib/channel-query";

/* The Channels list's first-row controls (`41` section 6, LoRA Studio `LibraryToolbar`): one search field, a Sort select
 * and a select for each filter. Each filter's first option is "all", worded as what it lets through; no chip rows. */

export interface QueryOption<V extends string> {
  readonly value: V;
  readonly label: string;
}

export const SEARCH_LABEL = "Search channels";
export const SEARCH_TIP = "Searches name, number, tvg-id and the playlist's name and host. Press Enter.";
export const SORT_LABEL = "Sort by";
export const KIND_LABEL = "Kind";
export const STATE_LABEL = "State";
export const ORIGIN_LABEL = "Origin";
export const STATUS_LABEL = "Stream status";
export const ENABLED_LABEL = "Enabled";
export const PLAYLIST_LABEL = "Playlist";
/** The most playlist names the Playlist select lists (the one chosen is always listed). */
export const PLAYLIST_OPTIONS_MAX = 20;
export const ALL_PLAYLISTS = "All playlists";

export const SORT_OPTIONS: readonly QueryOption<ChannelSortKey>[] = [
  { value: "name", label: "Name" },
  { value: "category", label: "Category" },
  { value: "kind", label: "Kind" },
  { value: "playlist", label: "Playlist" },
];

export const KIND_OPTIONS: readonly QueryOption<KindFilter>[] = [
  { value: "all", label: "All kinds" },
  { value: "live", label: "Live" },
  { value: "stream", label: "Stream" },
];

export const STATE_OPTIONS: readonly QueryOption<LiveStateFilter>[] = [
  { value: "all", label: "All states" },
  { value: "preparing", label: "Preparing" },
  { value: "starting", label: "Starting" },
  { value: "live", label: "Live" },
  { value: "restarting", label: "Restarting" },
  { value: "stopped", label: "Stopped" },
  { value: "failed", label: "Failed" },
];

export const STATUS_OPTIONS: readonly QueryOption<StatusFilter>[] = [
  { value: "all", label: "Any status" },
  { value: "live", label: "Live" },
  { value: "dead", label: "Dead" },
  { value: "unchecked", label: "Not checked" },
];

export const ORIGIN_OPTIONS: readonly QueryOption<OriginFilter>[] = [
  { value: "all", label: "All origins" },
  { value: "synced", label: "Synced" },
  { value: "edited", label: "Edited" },
  { value: "manual", label: "Hand-made" },
];

export const ENABLED_OPTIONS: readonly QueryOption<EnabledFilter>[] = [
  { value: "all", label: "Enabled or not" },
  { value: "true", label: "Enabled" },
  { value: "false", label: "Disabled" },
];

/** Why the first row's controls wait while a bulk run is going (the list must not move under it). */
export const QUERY_BUSY_REASON = "Working.";
