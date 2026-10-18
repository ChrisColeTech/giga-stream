import { useEffect, useRef } from "react";
import { ChevronRight, Info, Play } from "lucide-react";
import { IconButton } from "@giga/ui/controls/IconButton";
import { cn } from "@giga/ui/lib/cn";
import { PosterImage } from "@/components/ui/PosterImage";
import { LIBRARY_COPY } from "@/lib/library-copy";
import { spotlightOptionId } from "@/lib/spotlight-state";
import type { LibraryItem } from "@/types/library";

export interface SpotlightRowProps {
  readonly item: LibraryItem;
  /** The row the arrows have moved to: Enter plays it. It is filled with the accent, Spotlight's top hit. */
  readonly focused: boolean;
  readonly onHover: () => void;
  readonly onPlay: () => void;
  /** Opens Title information over the spotlight; the pressed Info is its opener. */
  readonly onInfo: (opener: HTMLElement) => void;
}

/** The icons wait out of sight on a resting row; the focused or hovered row, or a focused button, shows them. */
const ACTION = [
  "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 group-data-[focused]:opacity-100",
  /* On the accent fill the ghost buttons read in the ink colour, and hover darkens them, never greys them. */
  "group-data-[focused]:text-accent-ink group-data-[focused]:hover:bg-black/15 group-data-[focused]:hover:text-accent-ink",
].join(" ");

/** One result of Search titles (`06` section 4.6), a flat 44px option: a 28x42 poster, the title, its year and kind in
 *  dim mono on the same line, Play and Info as small ghost icon buttons, and, on the focused row, the chevron. */
export function SpotlightRow({ item, focused, onHover, onPlay, onInfo }: SpotlightRowProps) {
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focused) row.current?.scrollIntoView({ block: "nearest" });
  }, [focused]);

  return (
    <div
      ref={row}
      id={spotlightOptionId(item)}
      role="option"
      aria-selected={focused}
      data-focused={focused || undefined}
      onPointerEnter={onHover}
      className={cn(
        "group flex h-11 flex-none min-w-0 items-center gap-3 rounded-lg px-2",
        "transition-[background] duration-fade ease-linear",
        focused ? "bg-accent text-accent-ink" : "bg-transparent",
      )}
    >
      <span className="w-7 flex-none">
        <PosterImage src={item.posterUrl} alt={item.title} compact className="rounded-ctl" />
      </span>
      <span className={cn("min-w-0 flex-1 truncate text-sm", focused ? "font-medium" : "text-text")} title={item.title}>
        {item.title}
      </span>
      {item.year !== undefined && (
        <span className={cn("flex-none font-mono text-xs", focused ? "opacity-70" : "text-dim")}>{item.year}</span>
      )}
      <IconButton aria-label={LIBRARY_COPY.playTitle(item.title)} title={LIBRARY_COPY.playTitle(item.title)}
        className={ACTION} onClick={onPlay}>
        <Play className="size-3.5" aria-hidden />
      </IconButton>
      <IconButton aria-label={LIBRARY_COPY.infoTitle(item.title)} title={LIBRARY_COPY.infoTitle(item.title)}
        className={ACTION} onClick={(event) => onInfo(event.currentTarget)}>
        <Info className="size-3.5" aria-hidden />
      </IconButton>
      <ChevronRight
        aria-hidden data-chevron
        className="size-4 flex-none opacity-0 group-data-[focused]:opacity-100"
      />
    </div>
  );
}
