import type { RunningWorkJob } from "@giga/ui/shell/RunningWork";
import { STOP_BUILD, STOP_IDLE, STOP_SYNC } from "@/constants/record-copy";
import type { WorkCounts } from "@/store/work-slice";

/** What the statusbar's running-work piece shows for the work counts (`28` section 7.1). */
export interface WorkView {
  /** The work as the library draws it: null when idle. No progress is known, so the bar is full and pulses. */
  readonly running: RunningWorkJob | null;
  readonly liveCount: number;
  /** `2 preparing · 1 syncing`; absent while idle. */
  readonly readout: string | undefined;
  /** Why Stop is disabled. It always is: no route stops a build or a sync. */
  readonly stopReason: string;
}

export function workView({ preparing, syncing }: WorkCounts): WorkView {
  const parts: string[] = [];
  if (preparing > 0) parts.push(`${preparing} preparing`);
  if (syncing > 0) parts.push(`${syncing} syncing`);
  if (parts.length === 0) return { running: null, liveCount: 0, readout: undefined, stopReason: STOP_IDLE };
  const readout = parts.join(" · ");
  return {
    running: { label: readout, percent: null },
    liveCount: preparing + syncing,
    readout,
    stopReason: preparing > 0 ? STOP_BUILD : STOP_SYNC,
  };
}
