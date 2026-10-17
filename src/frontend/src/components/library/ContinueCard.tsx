import { Info, Play } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { continueLabel, progressRatio, remainingLabel } from "@/lib/library-facts";
import type { ResolvedItem } from "@/lib/library-marks";
import { posterTone } from "@/lib/poster-tone";
import { playRef } from "./library-service";
import { openTitleInfo } from "./open-title-info";
import { ProgressBar } from "./ProgressBar";

/* The landscape backdrop: the title's colour family washed over the surface, as the poster fallback does, at 16:9. */
const FOOT_FADE = "bg-[linear-gradient(to_top,color-mix(in_srgb,var(--color-surface)_92%,transparent),transparent)]";

/** One Continue Watching card (`06` section 4.2): a 16:9 backdrop tile in the title's colour family, with the title at
 *  its foot and the progress along its bottom edge. Play and Info show on hover and keyboard focus. Under the tile, one
 *  line: the time left. */
export function ContinueCard({ item }: { readonly item: ResolvedItem }) {
  const progress = item.progress;
  if (progress === undefined) return null;
  const label = continueLabel(item.title, progress);
  const ratio = progressRatio(progress);
  const remaining = remainingLabel(progress);
  const tone = `var(${posterTone(item.title)})`;
  return (
    <article aria-label={label} className="group/continue flex w-[260px] flex-none flex-col gap-1.5">
      <div
        className="relative aspect-video w-full overflow-hidden rounded-card"
        style={{
          background: `linear-gradient(160deg, color-mix(in srgb, ${tone} 46%, var(--color-surface)) 0%, var(--color-surface) 82%)`,
        }}
      >
        <div className="absolute inset-0 grid place-items-center gap-2 opacity-0 transition-opacity duration-fade group-hover/continue:opacity-100 group-focus-within/continue:opacity-100">
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="primary" onClick={() => playRef(item.ref)}>
              <Play aria-hidden /> Play
            </Button>
            <Button size="sm" onClick={(event) => openTitleInfo(item.ref, event.currentTarget)}>
              <Info aria-hidden /> Info
            </Button>
          </div>
        </div>
        <div className={cn("absolute inset-x-0 bottom-0 px-2.5 pt-8 pb-3", FOOT_FADE)}>
          <h3 className="m-0 line-clamp-2 font-sans text-[13px] leading-[1.2] font-semibold text-text">{label}</h3>
        </div>
        {ratio !== undefined && <ProgressBar ratio={ratio} className="absolute inset-x-0 bottom-0" />}
      </div>
      {remaining !== undefined && <p className="m-0 truncate font-mono text-[11px] text-dim">{remaining}</p>}
    </article>
  );
}
