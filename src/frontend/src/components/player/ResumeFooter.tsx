import { Button } from "@/components/ui/Button";
import { formatClock } from "@/lib/player-format";
import type { Progress } from "@/types/library";

export interface ResumeFooterProps {
  readonly progress: Progress;
  readonly onResume: () => void;
  readonly onStartOver: () => void;
}

/** Resume and Start over, pinned at the foot of the inspector as LoRA pins its job details under the queue
 *  (components/generate/JobDetails.tsx): the saved position, then the two verbs on an equal grid. The page shows it only
 *  while the video is paused and the item has a position to resume. */
export function ResumeFooter({ progress, onResume, onStartOver }: ResumeFooterProps) {
  return (
    <div role="status" className="flex flex-none flex-col gap-2.5 border-t border-border bg-surface p-2.75">
      <span className="font-mono text-xs text-faint">
        resume at <span className="text-muted tabular-nums">{formatClock(progress.positionMs)}</span>
      </span>
      <div className="grid grid-cols-2 gap-1.5">
        <Button variant="primary" full onClick={onResume}>
          Resume
        </Button>
        <Button variant="ghost" full onClick={onStartOver}>
          Start over
        </Button>
      </div>
    </div>
  );
}
