import { Button } from "@giga/ui/controls/Button";
import type { ReactNode } from "react";
import { Tooltip } from "@giga/ui/form/Tooltip";
import { formatClock } from "@/lib/player-format";
import type { Progress } from "@/types/library";

export interface ResumeFooterProps {
  readonly source?: ReactNode;
  readonly episodeNavigation?: ReactNode;
  readonly progress?: Progress;
  readonly resumeReason?: string;
  readonly startOverReason?: string;
  readonly onResume: () => void;
  readonly onStartOver: () => void;
}

/** Compact persistent inspector footer: optional source, saved position, then one equal-column action grid. */
export function ResumeFooter(props: ResumeFooterProps) {
  const actionGrid = props.episodeNavigation === undefined
    ? "mx-auto grid w-full max-w-[320px] min-w-0 grid-cols-2 gap-1.5"
    : "grid min-w-0 grid-cols-4 gap-1.5";
  return (
    <div role="status" className="flex flex-none flex-col gap-2 border-t border-border bg-surface p-2.5">
      {props.source}
      {props.progress !== undefined && <span className="font-mono text-xs text-faint">
        resume at <span className="text-muted tabular-nums">{formatClock(props.progress.positionMs)}</span>
      </span>}
      <div role="group" aria-label="Player actions" className={actionGrid}>
        {props.episodeNavigation}
        <Tooltip text={props.resumeReason ?? "Continue from the saved position."}
          focusable={props.resumeReason !== undefined} className="min-w-0 w-full"
          label={props.resumeReason === undefined ? undefined : `Resume. ${props.resumeReason}`}>
          <Button variant="primary" size="sm" full className="min-w-0" disabled={props.resumeReason !== undefined}
            onClick={props.onResume}>Resume</Button>
        </Tooltip>
        <Tooltip text={props.startOverReason ?? "Play this item from the beginning."}
          focusable={props.startOverReason !== undefined} className="min-w-0 w-full"
          label={props.startOverReason === undefined ? undefined : `Start over. ${props.startOverReason}`}>
          <Button variant="ghost" size="sm" full className="min-w-0" disabled={props.startOverReason !== undefined}
            onClick={props.onStartOver}>Start over</Button>
        </Tooltip>
      </div>
    </div>
  );
}
