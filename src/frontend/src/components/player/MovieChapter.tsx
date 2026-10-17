import { Film } from "lucide-react";
import { formatRuntime } from "@/lib/player-format";

export interface MovieChapterProps {
  readonly title: string;
  readonly runtimeMs: number | undefined;
  readonly quality: string | undefined;
}

/** A movie's compact chapter (`06` section 5.2): the title, its duration and quality when known, and a `Movie` identity.
 *  No season rows are invented for a film. */
export function MovieChapter({ title, runtimeMs, quality }: MovieChapterProps) {
  return (
    <div className="flex items-center gap-2.5 p-2.5">
      <span className="grid size-10 flex-none place-items-center rounded-ctl bg-surface text-muted">
        <Film className="size-4" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[13px] font-semibold text-text">{title}</span>
        <span className="flex items-center gap-2 font-mono text-[11px] text-muted tabular-nums">
          <span>Movie</span>
          {runtimeMs !== undefined && <span>{formatRuntime(runtimeMs)}</span>}
          {quality !== undefined && <span>{quality}</span>}
        </span>
      </div>
    </div>
  );
}
