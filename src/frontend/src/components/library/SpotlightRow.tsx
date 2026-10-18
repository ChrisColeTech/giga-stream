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

/** One result of Search titles (`06` section 4.6), in the list view's row shape: a compact poster, the title over its
 *  year and kind, then Play and Info as icon buttons. */
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
        "flex min-w-0 items-center gap-3 rounded-card border px-1.5 py-1.5",
        "transition-[background,border-color] duration-fade ease-linear",
        focused ? "border-accent-edge bg-accent-tint" : "border-transparent",
      )}
    >
      <span className="w-9 flex-none">
        <PosterImage src={item.posterUrl} alt={item.title} compact className="rounded-ctl" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-sm text-text" title={item.title}>{item.title}</span>
        <span className="truncate font-mono text-xs text-dim">
          {spotlightFacts(item, { movie: LIBRARY_COPY.movie, series: LIBRARY_COPY.series })}
        </span>
      </span>
      <IconButton aria-label={LIBRARY_COPY.playTitle(item.title)} title={LIBRARY_COPY.playTitle(item.title)}
        onClick={onPlay}>
        <Play className="size-3.5" aria-hidden />
      </IconButton>
      <IconButton aria-label={LIBRARY_COPY.infoTitle(item.title)} title={LIBRARY_COPY.infoTitle(item.title)}
        onClick={(event) => onInfo(event.currentTarget)}>
        <Info className="size-3.5" aria-hidden />
      </IconButton>
    </li>
  );
}
