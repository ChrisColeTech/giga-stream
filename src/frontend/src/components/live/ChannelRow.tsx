import type { KeyboardEvent, Ref } from "react";
import { LogoImage } from "@/components/ui/LogoImage";
import { StatusDot } from "@/components/ui/StatusDot";
import { cn } from "@/lib/cn";
import { PLAYING_MARKER } from "@/lib/live-constants";
import { statusDot, statusWord } from "@/lib/live-status";
import type { Channel } from "@/types/channel";

export interface ChannelRowProps {
  readonly channel: Channel;
  /** The row the selection is on (a bar on the left edge). */
  readonly selected: boolean;
  /** The channel the player has loaded (the marker). Selected and playing are different states. */
  readonly playing: boolean;
  /** The one row of the list that takes focus from Tab. */
  readonly tabStop: boolean;
  readonly onActivate: () => void;
  readonly ref?: Ref<HTMLLIElement>;
}

/** One channel: a 56 px logo, the number, the name on one line, the status dot with the category, and the markers. A click
 *  or Enter selects it and marks it playing. */
export function ChannelRow({ channel, selected, playing, tabStop, onActivate, ref }: ChannelRowProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLLIElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    onActivate();
  };

  return (
    <li
      ref={ref}
      role="option"
      aria-selected={selected}
      tabIndex={tabStop ? 0 : -1}
      data-selected={selected || undefined}
      data-playing={playing || undefined}
      onClick={onActivate}
      onKeyDown={onKeyDown}
      className={cn(
        "relative flex cursor-pointer items-center gap-2.5 py-2 pr-2.5 pl-3 outline-none",
        "focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-accent",
        selected ? "bg-hov" : "hover:bg-hov",
      )}
    >
      {selected && <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-accent" />}
      <LogoImage src={channel.logoUrl} alt={channel.name} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex min-w-0 items-baseline gap-1.5">
          {channel.number !== undefined && (
            <span className="flex-none font-mono text-[11px] text-dim tabular-nums">{channel.number}</span>
          )}
          <span className="min-w-0 truncate font-sans text-[13px] text-text">{channel.name}</span>
        </span>
        <span className="flex min-w-0 items-center gap-1.5 font-sans text-[11px] text-muted">
          <StatusDot state={statusDot(channel.status)} />
          <span className="sr-only">{statusWord(channel.status)}</span>
          <span className="min-w-0 truncate">{channel.category}</span>
          {playing && <span className="ml-auto flex-none font-mono text-[10px] text-accent-text">{PLAYING_MARKER}</span>}
        </span>
      </span>
    </li>
  );
}
