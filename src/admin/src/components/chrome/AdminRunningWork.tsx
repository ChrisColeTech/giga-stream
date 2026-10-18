import { Square } from "lucide-react";
import { Tooltip } from "@giga/ui/form/Tooltip";
import { cn } from "@giga/ui/lib/cn";
import type { WorkView } from "@/lib/running-work";

const BUTTON =
  "inline-flex cursor-pointer items-center gap-1.25 rounded-ctl border-0 bg-transparent px-1.5 py-0.5 " +
  "font-sans text-xs text-muted transition-[background-color,color] duration-fade ease-linear " +
  "hover:bg-hov hover:text-st-failed active:bg-hov disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-2.75";

export interface AdminRunningWorkProps {
  readonly view: WorkView;
  /** Stops every running job; acts on the first press (a confirm makes no sense on an emergency stop). */
  readonly onStop: () => void;
}

/** The statusbar's running work (`28` section 7.1, `44` section 4): a track that fills to the most recently updated job's
 *  fraction (a channel build alone fills it and pulses; an empty track and `idle` while nothing runs), the count in words
 *  (`1 syncing`), and `Stop`, enabled exactly while a job runs (title `Stop syncing`) and else disabled with its reason in
 *  the tooltip. The bar's own tooltip names the phase and counts. */
export function AdminRunningWork({ view, onStop }: AdminRunningWorkProps) {
  const stop = (
    <button
      type="button"
      className={BUTTON}
      disabled={!view.stoppable}
      title={view.stoppable ? view.stopText : undefined}
      onClick={onStop}
    >
      <Square aria-hidden /> Stop
    </button>
  );
  const pulsing = view.active && view.percent === null;
  return (
    <span className="inline-flex items-center gap-1.5" title={view.tooltip}>
      <span
        className="relative h-1.5 w-28 overflow-hidden rounded-full bg-surface"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={view.percent ?? undefined}
        aria-label="Running work"
      >
        <span
          className={cn(
            "absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-move ease-in",
            pulsing && "animate-pulse-busy",
          )}
          style={{ width: view.active ? `${view.percent ?? 100}%` : "0%" }}
        />
      </span>
      <span className="font-mono text-xs tabular-nums text-dim">{view.readout ?? "idle"}</span>
      {view.stoppable ? (
        stop
      ) : (
        <Tooltip text={view.stopText} focusable label={`Stop. ${view.stopText}`}>
          {stop}
        </Tooltip>
      )}
    </span>
  );
}
