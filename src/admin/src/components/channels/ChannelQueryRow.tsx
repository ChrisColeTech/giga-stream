import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { IconButton } from "@giga/ui/controls/IconButton";
import { QuerySearch } from "@giga/ui/lists/QuerySearch";
import { QuerySelect } from "@giga/ui/lists/QuerySelect";
import {
  ENABLED_LABEL,
  ENABLED_OPTIONS,
  KIND_LABEL,
  KIND_OPTIONS,
  ORIGIN_LABEL,
  ORIGIN_OPTIONS,
  SEARCH_LABEL,
  SEARCH_TIP,
  SORT_LABEL,
  SORT_OPTIONS,
  STATE_LABEL,
  STATE_OPTIONS,
} from "@/constants/channel-query-copy";
import {
  withDirection,
  withFilter,
  withSearch,
  withSortKey,
  type ChannelQuery,
} from "@/lib/channel-query";

export interface ChannelQueryRowProps {
  readonly query: ChannelQuery;
  readonly onQuery: (next: ChannelQuery) => void;
  /** Why the controls wait; absent when they work. */
  readonly reason?: string;
}

/** The controls of the Channels list's first row, in the shared `QuerySearch` and `QuerySelect` (LoRA Studio
 *  `LibraryToolbar`): the search field taking the row's width (it runs on Enter, never as you type), a Sort select with
 *  its direction, then a select for each filter (Kind, State, Origin, Enabled). */
export function ChannelQueryRow({ query, onQuery, reason }: ChannelQueryRowProps) {
  const [typed, setTyped] = useState(query.q);
  useEffect(() => setTyped(query.q), [query.q]);
  const pick =
    <K extends "kind" | "origin" | "enabled" | "state">(field: K) =>
    (value: ChannelQuery[K]): void =>
      onQuery(withFilter(query, field, value));
  const Direction = query.dir === "asc" ? ArrowUp : ArrowDown;
  const directionLabel = query.dir === "asc" ? "Ascending" : "Descending";
  return (
    <>
      <QuerySearch
        label={SEARCH_LABEL}
        tip={SEARCH_TIP}
        value={typed}
        reason={reason}
        onChange={setTyped}
        onEnter={() => onQuery(withSearch(query, typed))}
      />
      <QuerySelect
        label={SORT_LABEL}
        value={query.sort}
        options={SORT_OPTIONS}
        width="w-[190px]"
        reason={reason}
        onChange={(sort) => onQuery(withSortKey(query, sort))}
      />
      <IconButton
        aria-label={`${directionLabel}. Sort direction`}
        title={`${directionLabel}. Press to reverse`}
        reason={reason}
        onClick={() => onQuery(withDirection(query, query.dir === "asc" ? "desc" : "asc"))}
      >
        <Direction aria-hidden className="size-3.5" />
      </IconButton>
      <QuerySelect label={KIND_LABEL} value={query.kind} options={KIND_OPTIONS} reason={reason} onChange={pick("kind")} />
      <QuerySelect label={STATE_LABEL} value={query.state} options={STATE_OPTIONS} reason={reason} onChange={pick("state")} />
      <QuerySelect label={ORIGIN_LABEL} value={query.origin} options={ORIGIN_OPTIONS} reason={reason} onChange={pick("origin")} />
      <QuerySelect label={ENABLED_LABEL} value={query.enabled} options={ENABLED_OPTIONS} reason={reason} onChange={pick("enabled")} />
    </>
  );
}
