import { RunningWork } from "@giga/ui/shell/RunningWork";
import type { WorkView } from "@/lib/running-work";

export interface AdminRunningWorkProps {
  readonly view: WorkView;
  /** Stops every running job; acts on the first press (a confirm makes no sense on an emergency stop). */
  readonly onStop: () => void;
}

/** The statusbar's running work (`28` section 7.1, `44` section 4): the shared bar drawing `workView`'s output. Stop's
 *  words are `workView`'s `stopText` either way — its title while a job runs, its reason in the tooltip while not. */
export function AdminRunningWork({ view, onStop }: AdminRunningWorkProps) {
  return (
    <RunningWork
      view={{
        active: view.active,
        percent: view.percent,
        readout: view.readout,
        tooltip: view.tooltip,
        stoppable: view.stoppable,
        stopTitle: view.stopText,
        stopReason: view.stoppable ? undefined : view.stopText,
      }}
      onStop={onStop}
    />
  );
}
