import type { KeyboardEvent, Ref } from "react";
import { ACCENT } from "@/components/ui/Form";
import { LogoImage } from "@/components/ui/LogoImage";
import { cn } from "@giga/ui/lib/cn";
import { PLAYING_MARKER } from "@/lib/live-constants";
import { statusBar, statusWord } from "@/lib/live-status";
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

/** One channel in LoRA Studio's queue row shape (components/generate/QueueRow.tsx), which `SkeletonRows` mirrors: the
 *  status as the left-edge accent bar, a 4:3 logo in a 56px column, the number and name on the primary line, the
 *  category and the status word or playing marker on the meta line. A click or Enter selects it and marks it playing. */
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
        /* Selected is the fill alone: the left edge already carries the status bar, and two strips there read as one
           muddled mark. */
        selected && "bg-ctl",
      )}
    >
      <span className={cn("absolute top-2 bottom-2 left-0 w-1 rounded-full", ACCENT[statusBar(channel.status)])} aria-hidden />
      <LogoImage src={channel.logoUrl} alt={channel.name} />
      <span className="grid min-w-0 gap-1.25">
        <span className="min-w-0 truncate font-mono text-xs text-text">{name}</span>
        <span className="flex min-w-0 justify-between gap-2 overflow-hidden font-mono text-xs text-faint">
          <span className="truncate">{channel.category}</span>
          <span className={cn("flex-none", playing && "text-accent-text")}>
            {playing ? PLAYING_MARKER : statusWord(channel.status)}
          </span>
        </span>
      </span>
    </li>
  );
}
