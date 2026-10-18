import { cn } from "@giga/ui/lib/cn";
import { SHIMMER } from "@giga/ui/lib/shimmer";
import { formatDuration } from "@/lib/live-time";
import type { PlaylistEntry } from "@/types/admin-channel";

const WIDTHS = ["62%", "48%", "56%"];

/** A live channel's playlist in play order (`36` section 6, Status): each video's name and its `mm:ss`; the one on air
 *  (`nowPlaying.index`) in the accent text. With nothing listed the rows are shimmer lines, never a sentence. */
export function PlaylistRows({ playlist, playing }: { readonly playlist: readonly PlaylistEntry[]; readonly playing: number | null }) {
  if (playlist.length === 0) {
    return (
      <div className="flex w-full flex-col gap-3 py-2" aria-hidden>
        {WIDTHS.map((width) => (
          <span key={width} className={SHIMMER} style={{ width }} />
        ))}
      </div>
    );
  }
  return (
    <ol className="m-0 flex w-full min-w-0 list-none flex-col p-0" aria-label="Playlist">
      {playlist.map((entry, index) => (
        <li
          key={`${index}:${entry.name}`}
          aria-current={index === playing ? "true" : undefined}
          className={cn("flex h-8 min-w-0 items-center gap-3 font-mono text-sm", index === playing ? "text-accent-text" : "text-muted")}
        >
          <span className="w-6 flex-none text-right text-xs text-faint">{index + 1}</span>
          <span className="min-w-0 flex-1 truncate">{entry.name}</span>
          <span className="flex-none text-xs tabular-nums">{formatDuration(entry.durationMs)}</span>
        </li>
      ))}
    </ol>
  );
}
