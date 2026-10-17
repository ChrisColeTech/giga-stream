import { Button } from "@/components/ui/Button";
import { formatClock } from "@/lib/player-format";
import type { Progress } from "@/types/library";

export interface ResumeBannerProps {
  readonly progress: Progress;
  readonly onResume: () => void;
  readonly onStartOver: () => void;
}

/** The banner above the stage's picture (`06` section 5.3): Resume and Start over. */
export function ResumeBanner({ progress, onResume, onStartOver }: ResumeBannerProps) {
  return (
    <div role="status" className="flex h-9 flex-none items-center gap-2 border-b border-hair bg-panel px-2.5">
      <span className="min-w-0 flex-1 truncate font-sans text-xs text-muted">
        Resume at <span className="font-mono text-xs tabular-nums">{formatClock(progress.positionMs)}</span>
      </span>
      <Button size="sm" variant="primary" onClick={onResume}>
        Resume
      </Button>
      <Button size="sm" onClick={onStartOver}>
        Start over
      </Button>
    </div>
  );
}
