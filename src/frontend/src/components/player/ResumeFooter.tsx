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

/** Compact persistent inspector footer: optional source and episode slots, saved position, then its two actions. */
export function ResumeFooter(props: ResumeFooterProps) {
  return (
    <div role="status" className="flex flex-none flex-col gap-2 border-t border-border bg-surface p-2.5">
      {props.source}
      {props.episodeNavigation}
      {props.progress !== undefined && <span className="font-mono text-xs text-faint">
        resume at <span className="text-muted tabular-nums">{formatClock(props.progress.positionMs)}</span>
      </span>}
      <div className="flex items-center gap-1.5">
        <Tooltip text={props.resumeReason ?? "Continue from the saved position."}
          focusable={props.resumeReason !== undefined}
          label={props.resumeReason === undefined ? undefined : `Resume. ${props.resumeReason}`}>
          <Button variant="primary" size="sm" disabled={props.resumeReason !== undefined}
            onClick={props.onResume}>Resume</Button>
        </Tooltip>
        <Tooltip text={props.startOverReason ?? "Play this item from the beginning."}
          focusable={props.startOverReason !== undefined}
          label={props.startOverReason === undefined ? undefined : `Start over. ${props.startOverReason}`}>
          <Button variant="ghost" size="sm" disabled={props.startOverReason !== undefined}
            onClick={props.onStartOver}>Start over</Button>
        </Tooltip>
      </div>
    </div>
  );
}
