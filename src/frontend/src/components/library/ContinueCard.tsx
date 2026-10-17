import { Info, Play } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PosterImage } from "@/components/ui/PosterImage";
import { continueLabel, progressRatio, remainingLabel } from "@/lib/library-facts";
import type { ResolvedItem } from "@/lib/library-marks";
import { playRef } from "./library-service";
import { openTitleInfo } from "./open-title-info";
import { ProgressBar } from "./ProgressBar";

/** One Continue Watching card: the poster, the label, a progress bar, the remaining fact, and Play and Info. */
export function ContinueCard({ item }: { readonly item: ResolvedItem }) {
  const progress = item.progress;
  if (progress === undefined) return null;
  const ratio = progressRatio(progress);
  const remaining = remainingLabel(progress);
  return (
    <article className="flex w-[264px] gap-2.5 rounded-card border border-hair bg-panel p-2">
      <div className="w-14 flex-none">
        <PosterImage src={item.posterUrl} alt={item.title} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h3 className="m-0 truncate font-sans text-[13px] font-semibold text-text">
          {continueLabel(item.title, progress)}
        </h3>
        {remaining !== undefined && <p className="m-0 font-mono text-[11px] text-dim">{remaining}</p>}
        {ratio !== undefined && <ProgressBar ratio={ratio} />}
        <div className="mt-auto flex items-center gap-1.5 pt-1">
          <Button size="sm" onClick={() => playRef(item.ref)}>
            <Play aria-hidden /> Play
          </Button>
          <Button size="sm" onClick={(event) => openTitleInfo(item.ref, event.currentTarget)}>
            <Info aria-hidden /> Info
          </Button>
        </div>
      </div>
    </article>
  );
}
