import { Check, Clapperboard } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatRuntime } from "@/lib/player-format";
import type { EpisodeMarker } from "@/lib/player-view";
import type { Episode } from "@/types/title";

export interface EpisodeRowProps {
  readonly episode: Episode;
  readonly selected: boolean;
  readonly marker: EpisodeMarker | undefined;
  readonly onSelect: () => void;
}

/** One episode row (`06` section 5.2): a 16:9 still, `E1`, the title, the duration and the watch marker. Selecting a row
 *  marks the exact episode; nothing loads from it in phase 1. */
export function EpisodeRow({ episode, selected, marker, onSelect }: EpisodeRowProps) {
  const label = `E${episode.episode}`;
  const name = episode.title ?? label;
  return (
    <button
      type="button"
      aria-current={selected ? "true" : undefined}
      aria-label={`${label} ${name}`}
      onClick={onSelect}
      className={cn(
        "flex w-full cursor-pointer items-center gap-2.5 border-0 border-l-2 px-2 py-1.5 text-left font-sans",
        "transition-[background,color] duration-fade ease-linear",
        selected ? "border-l-accent bg-accent-tint text-accent-text" : "border-l-transparent bg-transparent text-muted hover:bg-hov hover:text-text",
      )}
    >
      <span className="relative flex aspect-video w-[88px] flex-none items-center justify-center overflow-hidden rounded-ctl bg-surface text-dim">
        {episode.stillUrl !== undefined ? (
          <img src={episode.stillUrl} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
        ) : (
          <Clapperboard className="size-4" aria-hidden />
        )}
        {marker !== undefined && !marker.watched && (
          <span className="absolute inset-x-0 bottom-0 h-0.5 bg-hair" aria-hidden>
            <span className="block h-full bg-accent" style={{ width: `${Math.round(marker.fraction * 100)}%` }} />
          </span>
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-dim tabular-nums">
          {label}
          {marker?.watched === true && <Check className="size-3 text-st-done" aria-label="Watched" />}
        </span>
        <span className="truncate text-xs">{name}</span>
      </span>
      {episode.runtimeMs !== undefined && (
        <span className="flex-none font-mono text-[11px] text-dim tabular-nums">{formatRuntime(episode.runtimeMs)}</span>
      )}
    </button>
  );
}
