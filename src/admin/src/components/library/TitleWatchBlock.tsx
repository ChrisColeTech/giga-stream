import { progressRatio, watchLine } from "@/lib/library-facts";
import type { Progress } from "@/types/library";
import { ProgressBar } from "./ProgressBar";

/** The watch progress of Title information, as a row's value: the episode, the watched state or the time left, and the
 *  bar under it. */
export function TitleWatchBlock({ progress }: { readonly progress: Progress }) {
  const ratio = progressRatio(progress);
  return (
    <div className="flex min-h-9 min-w-0 flex-1 flex-col justify-center gap-1.5">
      <span className="font-mono text-sm text-muted">{watchLine(progress)}</span>
      {ratio !== undefined && <ProgressBar ratio={ratio} className="rounded-full" />}
    </div>
  );
}
