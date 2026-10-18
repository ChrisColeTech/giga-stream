import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import { IconButton } from "@giga/ui/controls/IconButton";
import { Input } from "@giga/ui/controls/Input";
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
import { QuerySelect } from "./QuerySelect";

export interface ChannelQueryRowProps {
  readonly query: ChannelQuery;
  readonly onQuery: (next: ChannelQuery) => void;
  /** Why the controls wait; absent when they work. */
  readonly reason?: string;
}

/** The controls that open the Channels list's first row (LoRA Studio `LibraryToolbar`): the search field taking the
 *  row's width with a leading search icon (it carries `data-search`, so `Ctrl+F` focuses it; it runs on Enter, never as
 *  you type), then a Sort select with its direction, then a select for each filter (Kind, State, Origin, Enabled). They
 *  wrap with `Refresh` and the selection verbs when the row is narrow. No labelled rows, no chips. */
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
      <span className="relative min-w-52 flex-1">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-dim" />
        <Input
          type="search"
          value={typed}
          title={reason ?? SEARCH_TIP}
          aria-label={SEARCH_LABEL}
          data-search=""
          autoComplete="off"
          spellCheck={false}
          disabled={reason !== undefined}
          className="h-ctl-sm! pl-7! text-xs!"
          onChange={(event) => setTyped(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onQuery(withSearch(query, typed));
          }}
        />
      </span>
      <QuerySelect
        label={SORT_LABEL}
        value={query.sort}
        options={SORT_OPTIONS}
        reason={reason}
        onChange={(sort) => onQuery(withSortKey(query, sort))}
      />
      <IconButton
        aria-label={`${directionLabel}. Sort direction`}
        title={`${directionLabel}. Press to reverse`}
        reason={reason}
        className="size-ctl-sm!"
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
