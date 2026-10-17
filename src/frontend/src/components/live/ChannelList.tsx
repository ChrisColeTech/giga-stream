import type { KeyboardEvent } from "react";
import { useRef } from "react";
import { SkeletonRows } from "@/components/ui/SkeletonRows";
import { channelListRender, keyTarget, tabStopId } from "@/lib/live-channels";
import { CHANNEL_LIST_LABEL, LIST_SKELETON_ROWS } from "@/lib/live-constants";
import type { Channel } from "@/types/channel";
import { ChannelRow } from "./ChannelRow";

export interface ChannelListProps {
  /** The rows the search and category leave, in published order. */
  readonly rows: readonly Channel[];
  readonly loading: boolean;
  readonly selectedId: string | null;
  readonly playingId: string | null;
  /** Up, Down, Home and End: move the selection and focus only; they never start a channel. */
  readonly onSelect: (id: string) => void;
  /** A click or Enter: select the channel and mark it playing. */
  readonly onActivate: (id: string) => void;
}

/** The channel rows as one listbox with a single tab stop. Only a pending read draws skeleton rows. */
export function ChannelList({ rows, loading, selectedId, playingId, onSelect, onActivate }: ChannelListProps) {
  const elements = useRef(new Map<string, HTMLLIElement>());

  if (channelListRender(loading) === "skeleton") return <SkeletonRows count={LIST_SKELETON_ROWS} />;

  const ids = rows.map((row) => row.id);
  const stop = tabStopId(ids, selectedId);

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const target = keyTarget(ids, selectedId, event.key);
    if (target === null) return;
    event.preventDefault();
    onSelect(target);
    elements.current.get(target)?.focus();
  };

  return (
    <ul
      role="listbox"
      aria-label={CHANNEL_LIST_LABEL}
      onKeyDown={onKeyDown}
      className="m-0 flex min-h-0 flex-1 list-none flex-col overflow-x-hidden overflow-y-auto border-t border-hair p-0"
    >
      {rows.map((row) => (
        <ChannelRow
          key={row.id}
          ref={(element) => {
            if (element) elements.current.set(row.id, element);
            else elements.current.delete(row.id);
          }}
          channel={row}
          selected={row.id === selectedId}
          playing={row.id === playingId}
          tabStop={row.id === stop}
          onActivate={() => onActivate(row.id)}
        />
      ))}
    </ul>
  );
}
