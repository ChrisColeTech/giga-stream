import { RefreshCw } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import {
  CHANNELS_HEADING,
  REASON_NEEDS_FILESERVER,
  REFRESH_LABEL,
} from "@/lib/live-constants";
import type { Channel, ChannelList as ChannelData } from "@/types/channel";
import { ChannelDetails } from "./ChannelDetails";
import { ChannelList } from "./ChannelList";
import { ChannelSearch } from "./ChannelSearch";

export interface LiveChannelsPaneProps {
  readonly list: ChannelData;
  /** The rows the search and category leave. */
  readonly rows: readonly Channel[];
  readonly loading: boolean;
  readonly query: string;
  readonly category: string;
  readonly selected: Channel | null;
  readonly playingId: string | null;
  readonly onQueryChange: (query: string) => void;
  readonly onCategoryChange: (category: string) => void;
  readonly onSelect: (id: string) => void;
  readonly onActivate: (id: string) => void;
}

/** The right pane: the heading with the total and Refresh, the search and category, the channel rows (the one scroll
 *  container) and Details at the foot. */
export function LiveChannelsPane({
  list,
  rows,
  loading,
  query,
  category,
  selected,
  playingId,
  onQueryChange,
  onCategoryChange,
  onSelect,
  onActivate,
}: LiveChannelsPaneProps) {
  return (
    <div className="flex size-full min-h-0 flex-col">
      <div className="flex h-9 flex-none items-center gap-2 px-3">
        <h2 className="font-sans text-[13px] font-semibold text-text">{CHANNELS_HEADING}</h2>
        <span className="font-mono text-[11px] text-dim tabular-nums">{list.items.length}</span>
        <span title={REASON_NEEDS_FILESERVER} className="ml-auto inline-flex">
          <IconButton disabled aria-label={REFRESH_LABEL}>
            <RefreshCw className="size-3.75" aria-hidden />
          </IconButton>
        </span>
      </div>
      <ChannelSearch
        query={query}
        onQueryChange={onQueryChange}
        category={category}
        categories={list.categories}
        total={list.items.length}
        onCategoryChange={onCategoryChange}
      />
      <ChannelList
        rows={rows}
        loading={loading}
        selectedId={selected?.id ?? null}
        playingId={playingId}
        onSelect={onSelect}
        onActivate={onActivate}
      />
      <div className="flex-none border-t border-hair">
        <ChannelDetails channel={selected} />
      </div>
    </div>
  );
}
