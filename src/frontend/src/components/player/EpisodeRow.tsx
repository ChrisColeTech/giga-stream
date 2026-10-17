import { Clapperboard } from "lucide-react";
import { ACCENT } from "@/components/ui/Form";
import { cn } from "@/lib/cn";
import { formatRuntime } from "@/lib/player-format";
import type { EpisodeMarker } from "@/lib/player-view";
import type { Episode } from "@/types/title";

export interface EpisodeRowProps {
  readonly episode: Episode;
  readonly selected: boolean;
  readonly marker: EpisodeMarker | undefined;
  readonly onSelect: () => void;
  /** The meta line's code: `E1` by default; "Movie" or "Local file" when the row is a whole title. */
  readonly code?: string;
}

/** One episode row (`06` section 5.2) in LoRA Studio's queue row shape (components/generate/QueueRow.tsx), which the
 *  rail's `SkeletonRows` mirrors: a 4:3 still in a 56px column, the title on the primary line, the episode number and
 *  duration on the meta line. A watched episode wears the success bar on its left edge; one part watched carries the
 *  2px progress hairline. Selecting a row marks the exact episode. */
export function EpisodeRow({ episode, selected, marker, onSelect, code }: EpisodeRowProps) {
  const label = code ?? `E${episode.episode}`;
  const name = episode.title ?? label;
  const watched = marker?.watched === true;
  return (
    <button
      type="button"
      aria-current={selected ? "true" : undefined}
      aria-label={`${label} ${name}`}
      onClick={onSelect}
      className={cn(
        "relative grid w-full cursor-pointer grid-cols-[56px_minmax(0,1fr)] items-start gap-x-2.5 text-left",
        "border-0 border-b border-l-2 border-hair px-2.75 py-2",
        "transition-colors duration-fade ease-linear hover:bg-hov",
        selected ? "border-l-accent bg-ctl" : "border-l-transparent bg-transparent",
      )}
    >
      {watched && <span className={cn("absolute top-2 bottom-2 left-0 w-1 rounded-full", ACCENT.success)} aria-hidden />}
      <span className="relative grid aspect-4/3 w-full place-items-center overflow-hidden rounded-ctl border border-hair bg-surface">
        {episode.stillUrl !== undefined ? (
          <img src={episode.stillUrl} alt="" loading="lazy" className="absolute inset-0 block size-full object-cover" />
        ) : (
          <Clapperboard className="size-4 text-dim" aria-hidden />
        )}
      </span>
      <span className="grid min-w-0 gap-1.25">
        <span className="min-w-0 truncate font-mono text-xs text-text">{name}</span>
        {marker !== undefined && !watched && (
          <span className="block h-0.5 overflow-hidden rounded-[2px] bg-hair">
            <i className="block h-full bg-accent" style={{ width: `${Math.round(marker.fraction * 100)}%` }} />
          </span>
        )}
        <span className="flex min-w-0 justify-between gap-2 overflow-hidden font-mono text-xs text-faint">
          <span className="truncate">{watched ? `${label} · watched` : label}</span>
          {episode.runtimeMs !== undefined && <span className="flex-none">{formatRuntime(episode.runtimeMs)}</span>}
        </span>
      </span>
    </button>
  );
}
