import { cn } from "@/lib/cn";
import { continueLabel, progressRatio, remainingLabel } from "@/lib/library-facts";
import type { ResolvedItem } from "@/lib/library-marks";
import { posterTone } from "@/lib/poster-tone";
import { CardActions } from "./CardActions";
import { openTitleInfo } from "./open-title-info";
import { ProgressBar } from "./ProgressBar";
import { TILE_FRAME, TILE_IDLE } from "./tile-chrome";

/** One Continue watching card (`06` section 4.2), on LoRA's gallery tile: a 16:9 backdrop in the title's color family as
 *  the art, progress along its foot, one line under it naming the title and the time left, then Play and Info. */
export function ContinueCard({ item }: { readonly item: ResolvedItem }) {
  const progress = item.progress;
  if (progress === undefined) return null;
  const label = continueLabel(item.title, progress);
  const ratio = progressRatio(progress);
  const remaining = remainingLabel(progress);
  const tone = `var(${posterTone(item.title)})`;
  return (
    <article aria-label={label} className="flex w-[260px] flex-none flex-col gap-1">
      <button
        type="button"
        title={label}
        aria-label={label}
        onClick={(event) => openTitleInfo(item.ref, event.currentTarget)}
        className={cn(TILE_FRAME, "aspect-video", TILE_IDLE)}
        style={{
          background: `linear-gradient(160deg, color-mix(in srgb, ${tone} 46%, var(--color-surface)) 0%, var(--color-surface) 82%)`,
        }}
      >
        {ratio !== undefined && <ProgressBar ratio={ratio} className="absolute inset-x-0 bottom-0" />}
      </button>
      <span className="flex min-w-0 justify-between gap-2 font-mono text-xs">
        <span className="truncate text-text">{label}</span>
        {remaining !== undefined && <span className="flex-none text-faint">{remaining}</span>}
      </span>
      <CardActions item={item} />
    </article>
  );
}
