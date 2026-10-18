import { useEffect, useRef } from "react";
import { Info, Play } from "lucide-react";
import { IconButton } from "@giga/ui/controls/IconButton";
import { cn } from "@giga/ui/lib/cn";
import { PosterImage } from "@/components/ui/PosterImage";
import { LIBRARY_COPY } from "@/lib/library-copy";
import { spotlightFacts } from "@/lib/spotlight-state";
import type { LibraryItem } from "@/types/library";

export interface SpotlightRowProps {
  readonly item: LibraryItem;
  /** The row the arrows have moved to: Enter plays it. */
  readonly focused: boolean;
  readonly onHover: () => void;
  readonly onPlay: () => void;
  /** Opens Title information over the spotlight; the pressed Info is its opener. */
  readonly onInfo: (opener: HTMLElement) => void;
}

/** The icons wait out of sight on a resting row; the selected or hovered row, or a focused button, shows them. */
const ACTION = "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 group-data-[focused]:opacity-100";

/** One result of Search titles (`06` section 4.6), a flat 44px menu-like row: a 28x42 poster, the title, its year and
 *  kind in dim mono on the same line, then Play and Info as small ghost icon buttons. */
export function SpotlightRow({ item, focused, onHover, onPlay, onInfo }: SpotlightRowProps) {
  const row = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (focused) row.current?.scrollIntoView({ block: "nearest" });
  }, [focused]);

  return (
    <li
      ref={row}
      data-focused={focused || undefined}
      aria-current={focused || undefined}
      onPointerEnter={onHover}
      className={cn(
        "group flex h-11 flex-none min-w-0 items-center gap-3 rounded-lg px-2",
        "transition-[background] duration-fade ease-linear",
        focused ? "bg-accent-tint" : "bg-transparent",
      )}
    >
      <span className="w-7 flex-none">
        <PosterImage src={item.posterUrl} alt={item.title} compact className="rounded-ctl" />
      </span>
      <span className="flex min-w-0 flex-1 items-baseline gap-2.5">
        <span className="min-w-0 truncate text-sm text-text" title={item.title}>{item.title}</span>
        <span className="flex-none font-mono text-xs whitespace-nowrap text-dim">
          {spotlightFacts(item, { movie: LIBRARY_COPY.movie, series: LIBRARY_COPY.series })}
        </span>
      </span>
      <IconButton aria-label={LIBRARY_COPY.playTitle(item.title)} title={LIBRARY_COPY.playTitle(item.title)}
        className={ACTION} onClick={onPlay}>
        <Play className="size-3.5" aria-hidden />
      </IconButton>
      <IconButton aria-label={LIBRARY_COPY.infoTitle(item.title)} title={LIBRARY_COPY.infoTitle(item.title)}
        className={ACTION} onClick={(event) => onInfo(event.currentTarget)}>
        <Info className="size-3.5" aria-hidden />
      </IconButton>
    </li>
  );
}
