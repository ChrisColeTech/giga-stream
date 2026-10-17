import { progressRatio, watchLine } from "@/lib/library-facts";
import type { Progress } from "@/types/library";
import { ProgressBar } from "./ProgressBar";

/** The watch block of Title information: the episode, the watched state or the time left, and the bar. */
export function TitleWatchBlock({ progress }: { readonly progress: Progress }) {
  const ratio = progressRatio(progress);
  return (
    <div className="flex flex-col gap-1.5 rounded-card border border-hair bg-surface p-2.5">
      <p className="m-0 font-sans text-xs text-text">{watchLine(progress)}</p>
      {ratio !== undefined && <ProgressBar ratio={ratio} />}
    </div>
  );
}
