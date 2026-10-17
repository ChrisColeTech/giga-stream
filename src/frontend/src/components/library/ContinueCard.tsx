import { cn } from "@/lib/cn";
import { continueLabel, progressRatio, remainingLabel } from "@/lib/library-facts";
import type { ResolvedItem } from "@/lib/library-marks";
import { posterTone } from "@/lib/poster-tone";
import { CardActions } from "./CardActions";
import { CARD_FOOT_FADE, CARD_HEAD_FADE, CARD_LIFT, CARD_REVEAL } from "./card-chrome";
import { ProgressBar } from "./ProgressBar";

/** One Continue watching card (`06` section 4.2): a 16:9 backdrop tile in the title's colour family. Its title sits at the
 *  top left and stays on screen; Play and Info are round icon buttons at the lower left, shown on hover and on keyboard
 *  focus. The progress runs along the bottom edge, and under the tile sits one line: the time left. */
export function ContinueCard({ item }: { readonly item: ResolvedItem }) {
  const progress = item.progress;
  if (progress === undefined) return null;
  const label = continueLabel(item.title, progress);
  const ratio = progressRatio(progress);
  const remaining = remainingLabel(progress);
  const tone = `var(${posterTone(item.title)})`;
  return (
    <article aria-label={label} className="group/card flex w-[260px] flex-none flex-col gap-1.5">
      <div
        className={cn("relative aspect-video w-full overflow-hidden rounded-card", CARD_LIFT)}
        style={{
          background: `linear-gradient(160deg, color-mix(in srgb, ${tone} 46%, var(--color-surface)) 0%, var(--color-surface) 82%)`,
        }}
      >
        <div className={cn("absolute inset-x-0 top-0 px-2.5 pt-2.5 pb-8", CARD_HEAD_FADE)}>
          <h3 title={label} className="m-0 line-clamp-2 font-sans text-[15px] leading-[1.15] font-semibold text-text">
            {label}
          </h3>
        </div>
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 flex items-end px-2.5 pt-8 pb-3",
            CARD_FOOT_FADE,
            CARD_REVEAL,
          )}
        >
          <div className="pointer-events-auto flex items-center gap-1.5">
            <CardActions item={item} />
          </div>
        </div>
        {ratio !== undefined && <ProgressBar ratio={ratio} className="absolute inset-x-0 bottom-0" />}
      </div>
      {remaining !== undefined && <p className="m-0 truncate font-mono text-[11px] text-dim">{remaining}</p>}
    </article>
  );
}
