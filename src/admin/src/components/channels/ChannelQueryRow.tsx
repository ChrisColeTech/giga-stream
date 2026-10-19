import { useEffect, useState } from "react";
import { QueryBar } from "@giga/ui/lists/QueryBar";
import { QuerySearch } from "@giga/ui/lists/QuerySearch";
import { QuerySelect } from "@giga/ui/lists/QuerySelect";
import { SortControl } from "@giga/ui/lists/SortControl";
import {
  ENABLED_LABEL,
  ENABLED_OPTIONS,
  KIND_LABEL,
  KIND_OPTIONS,
  ORIGIN_LABEL,
  ORIGIN_OPTIONS,
  PLAYLIST_LABEL,
  SEARCH_LABEL,
  SEARCH_TIP,
  SORT_LABEL,
  SORT_OPTIONS,
  STATE_LABEL,
  STATE_OPTIONS,
  STATUS_LABEL,
  STATUS_OPTIONS,
  type QueryOption,
} from "@/constants/channel-query-copy";
import {
  withDirection,
  withFilter,
  withPlaylist,
  withSearch,
  withSortKey,
  type ChannelQuery,
} from "@/lib/channel-query";

export interface ChannelQueryRowProps {
  readonly query: ChannelQuery;
  readonly onQuery: (next: ChannelQuery) => void;
  /** The Playlist select's options: `All playlists`, then the playlist names (`lib/channel-playlist-options.ts`). */
  readonly playlists: readonly QueryOption<string>[];
  /** Why the controls wait; absent when they work. */
  readonly reason?: string;
}

/** The controls of the Channels list's first row, in the shared `QuerySearch` and `QuerySelect` (LoRA Studio
 *  `LibraryToolbar`): the search field taking the row's width (it runs on Enter, never as you type), a Sort select with
 *  its direction, then a select for each filter (Kind, State, Origin, Playlist, Stream status, Enabled). */
export function ChannelQueryRow({ query, onQuery, playlists, reason }: ChannelQueryRowProps) {
  const [typed, setTyped] = useState(query.q);
  useEffect(() => setTyped(query.q), [query.q]);
  const pick =
    <K extends "kind" | "origin" | "enabled" | "state" | "status">(field: K) =>
    (value: ChannelQuery[K]): void =>
      onQuery(withFilter(query, field, value));
  return (
    <QueryBar
      search={
        <QuerySearch
          label={SEARCH_LABEL}
          tip={SEARCH_TIP}
          value={typed}
          reason={reason}
          onChange={setTyped}
          onEnter={() => onQuery(withSearch(query, typed))}
        />
      }
    >
      <SortControl
        label={SORT_LABEL}
        value={query.sort}
        options={SORT_OPTIONS}
        reason={reason}
        onChange={(sort) => onQuery(withSortKey(query, sort))}
        direction={{
          value: query.dir,
          onToggle: () => onQuery(withDirection(query, query.dir === "asc" ? "desc" : "asc")),
        }}
      />
      <QuerySelect label={KIND_LABEL} value={query.kind} options={KIND_OPTIONS} reason={reason} onChange={pick("kind")} />
      <QuerySelect label={STATE_LABEL} value={query.state} options={STATE_OPTIONS} reason={reason} onChange={pick("state")} />
      <QuerySelect label={ORIGIN_LABEL} value={query.origin} options={ORIGIN_OPTIONS} reason={reason} onChange={pick("origin")} />
      <QuerySelect
        label={PLAYLIST_LABEL}
        value={query.playlist}
        options={playlists}
        reason={reason}
        onChange={(playlist) => onQuery(withPlaylist(query, playlist))}
      />
      <QuerySelect label={STATUS_LABEL} value={query.status} options={STATUS_OPTIONS} reason={reason} onChange={pick("status")} />
      <QuerySelect label={ENABLED_LABEL} value={query.enabled} options={ENABLED_OPTIONS} reason={reason} onChange={pick("enabled")} />
    </QueryBar>
  );
}
