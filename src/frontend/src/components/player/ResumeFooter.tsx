import { Button } from "@giga/ui/controls/Button";
import type { ReactNode } from "react";
import { Tooltip } from "@/components/ui/Tooltip";
import { formatClock } from "@/lib/player-format";
import type { Progress } from "@/types/library";

export interface ResumeFooterProps {
  readonly children?: ReactNode;
  readonly progress?: Progress;
  readonly resumeReason?: string;
  readonly startOverReason?: string;
  readonly onResume: () => void;
  readonly onStartOver: () => void;
}

/** Resume and Start over, pinned at the foot of the inspector as LoRA pins its job details under the queue
 *  (components/generate/JobDetails.tsx): the saved position, then the two verbs on an equal grid. The page shows it only
 *  in every state; unavailable actions stay disabled with accessible reason tooltips. */
export function ResumeFooter({ children, progress, resumeReason, startOverReason, onResume, onStartOver }: ResumeFooterProps) {
  return (
    <div role="status" className="flex flex-none flex-col gap-2.5 border-t border-border bg-surface p-2.75">
      {children}
      {progress !== undefined && <span className="font-mono text-xs text-faint">
        resume at <span className="text-muted tabular-nums">{formatClock(progress.positionMs)}</span>
      </span>}
      <div className="grid grid-cols-2 gap-1.5">
        <Tooltip className="min-w-0" text={resumeReason ?? "Continue from the saved position."}
          focusable={resumeReason !== undefined} label={resumeReason === undefined ? undefined : `Resume. ${resumeReason}`}>
          <Button variant="primary" full disabled={resumeReason !== undefined} onClick={onResume}>Resume</Button>
        </Tooltip>
        <Tooltip className="min-w-0" text={startOverReason ?? "Play this item from the beginning."}
          focusable={startOverReason !== undefined}
          label={startOverReason === undefined ? undefined : `Start over. ${startOverReason}`}>
          <Button variant="ghost" full disabled={startOverReason !== undefined} onClick={onStartOver}>Start over</Button>
        </Tooltip>
      </div>
    </div>
  );
}
