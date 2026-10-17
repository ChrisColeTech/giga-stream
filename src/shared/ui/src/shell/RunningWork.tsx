import { Square } from "lucide-react";
import { cn } from "../lib/cn";

export interface RunningWorkJob {
  readonly label: string;
  /** The percent it can say, already clamped to 0 to 100; null when it cannot say how far it is. */
  readonly percent: number | null;
}

export interface RunningWorkProps {
  /** The first live job, or null while nothing runs. */
  readonly running: RunningWorkJob | null;
  /** How many jobs are live. */
  readonly liveCount: number;
  /** Stop acts on the first press: a confirm makes no sense on an emergency stop. */
  readonly onStop: () => void;
}

const BUTTON =
  "inline-flex cursor-pointer items-center gap-1.25 rounded-ctl border-0 bg-transparent px-1.5 py-0.5 " +
  "font-sans text-xs text-muted transition-[background-color,color] duration-fade ease-linear " +
  "hover:bg-hov hover:text-st-failed active:bg-hov disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-2.75";

/* LoRA Studio's running work: a bar that fills, the count of live jobs with the first one's percent, and Stop. An empty
 * track and "idle" while nothing runs: the bar is furniture, not a sentence. A job that cannot say how far it is (a scan
 * walking its folder) fills the bar and pulses. */
export function RunningWork({ running, liveCount, onStop }: RunningWorkProps) {
  const percent = running?.percent ?? null;
  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={running === null ? "Nothing running" : `${running.label}${percent === null ? "" : ` · ${percent}%`}`}
    >
      <span
        className="relative h-1.5 w-28 overflow-hidden rounded-full bg-surface"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
        aria-label="Running work"
      >
        <span
          className={cn(
            "absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-move ease-in",
            running !== null && percent === null && "animate-pulse-busy",
          )}
          style={{ width: running === null ? "0%" : `${percent ?? 100}%` }}
        />
      </span>
      <span className="font-mono text-xs tabular-nums text-dim">
        {running === null ? "idle" : `${liveCount} running${percent === null ? "" : ` · ${percent}%`}`}
      </span>
      <button
        type="button"
        className={BUTTON}
        disabled={running === null}
        title={running === null ? "Nothing to stop" : `Stop ${running.label.toLowerCase()}`}
        onClick={onStop}
      >
        <Square aria-hidden /> Stop
      </button>
    </span>
  );
}
