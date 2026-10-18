import { Square } from "lucide-react";
import { Tooltip } from "../form/Tooltip";
import { cn } from "../lib/cn";

/** What the bar draws, built by the program (`50` section 2.2): the program owns the numbers and the words, the kit
 *  only draws them. `percent` null while the work cannot say how far it is: the bar fills and pulses. */
export interface WorkView {
  /** Anything running: the track fills; false draws an empty track and `idle`. */
  readonly active: boolean;
  /** How full the bar is, 0 to 100, already clamped; null when indeterminate. */
  readonly percent: number | null;
  /** The words beside the bar (`N running · X%`, the admin's `2 preparing · 1 syncing`); absent reads `idle`. */
  readonly readout?: string;
  /** The bar's own tooltip (`Nothing running`, the admin's phase and counts). */
  readonly tooltip?: string;
  /** Stop is enabled exactly while this is true. */
  readonly stoppable: boolean;
  /** Stop's title while it works (`Stop scanning`, `Nothing to stop`). */
  readonly stopTitle: string;
  /** Why Stop cannot be used even while work runs. Present, Stop is natively disabled inside the focusable `Tooltip`
   *  labelled "Stop. reason". */
  readonly stopReason?: string;
}

export interface RunningWorkProps {
  /** The built view. */
  readonly view: WorkView;
  /** Stop acts on the first press: a confirm makes no sense on an emergency stop. */
  readonly onStop: () => void;
}

const BUTTON =
  "inline-flex cursor-pointer items-center gap-1.25 rounded-ctl border-0 bg-transparent px-1.5 py-0.5 " +
  "font-sans text-xs text-muted transition-[background-color,color] duration-fade ease-linear " +
  "hover:bg-hov hover:text-st-failed active:bg-hov disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-2.75";

/* LoRA Studio's running work: a bar that fills, the built readout, and Stop. An empty track and "idle" while nothing
 * runs: the bar is furniture, not a sentence. Work that cannot say how far it is (a scan walking its folder) fills the
 * bar and pulses. The track wears the nav pill's edge (`border border-ctl-edge`, TabPill), so it reads on Theatre's
 * black bar, which the token remap cannot darken (`50` section 2.2). */
export function RunningWork({ view, onStop }: RunningWorkProps) {
  const stop = (
    <button
      type="button"
      className={BUTTON}
      disabled={!view.stoppable}
      title={view.stopReason === undefined ? view.stopTitle : undefined}
      onClick={onStop}
    >
      <Square aria-hidden /> Stop
    </button>
  );
  return (
    <span className="inline-flex items-center gap-1.5" title={view.tooltip}>
      <span
        className="relative h-1.5 w-28 overflow-hidden rounded-full border border-ctl-edge bg-surface"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={view.percent ?? undefined}
        aria-label="Running work"
      >
        <span
          className={cn(
            "absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-move ease-in",
            view.active && view.percent === null && "animate-pulse-busy",
          )}
          style={{ width: view.active ? `${view.percent ?? 100}%` : "0%" }}
        />
      </span>
      <span className="font-mono text-xs tabular-nums text-dim">{view.readout ?? "idle"}</span>
      {view.stopReason === undefined ? (
        stop
      ) : (
        <Tooltip text={view.stopReason} focusable label={`Stop. ${view.stopReason}`}>
          {stop}
        </Tooltip>
      )}
    </span>
  );
}
