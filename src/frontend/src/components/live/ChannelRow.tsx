import type { KeyboardEvent, Ref } from "react";
import { LogoImage } from "@/components/ui/LogoImage";
import { cn } from "@giga/ui/lib/cn";
import { PLAYING_MARKER } from "@/lib/live-constants";
import type { Channel } from "@/types/channel";

export interface ChannelRowProps {
  readonly channel: Channel;
  /** The row the selection is on (the control fill). */
  readonly selected: boolean;
  /** The channel the player has loaded (the marker). Selected and playing are different states. */
  readonly playing: boolean;
  /** The one row of the list that takes focus from Tab. */
  readonly tabStop: boolean;
  readonly onActivate: () => void;
  readonly ref?: Ref<HTMLLIElement>;
}

/** One channel in LoRA Studio's queue row shape (components/generate/QueueRow.tsx), which `SkeletonRows` mirrors: a 4:3
 *  logo in a 56px column, the number and name on the primary line, the category and, on the channel the player has
 *  loaded, the playing marker on the meta line. Nothing checks a stream, so there is no status word or bar (`46`
 *  section D.2). A click or Enter selects it and marks it playing. */
export function ChannelRow({ channel, selected, playing, tabStop, onActivate, ref }: ChannelRowProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLLIElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    onActivate();
  };
  const name = channel.number === undefined ? channel.name : `${channel.number} ${channel.name}`;

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
        "relative grid w-full cursor-pointer grid-cols-[56px_minmax(0,1fr)] items-start gap-x-2.5 outline-none",
        "border-b border-hair px-2.75 py-2",
        "transition-colors duration-fade ease-linear hover:bg-hov",
        "focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-accent",
        /* Selected is the control fill alone. */
        selected && "bg-ctl",
      )}
    >
      <LogoImage src={channel.logoUrl} alt={channel.name} />
      <span className="grid min-w-0 gap-1.25">
        <span className="min-w-0 truncate font-mono text-xs text-text">{name}</span>
        <span className="flex min-w-0 justify-between gap-2 overflow-hidden font-mono text-xs text-faint">
          <span className="truncate">{channel.category}</span>
          {playing && <span className="flex-none text-accent-text">{PLAYING_MARKER}</span>}
        </span>
      </span>
    </li>
  );
}
