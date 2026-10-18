import { STOP_BUILD, STOP_IDLE, STOP_SYNCING } from "@/constants/record-copy";
import type { WorkCounts } from "@/store/work-slice";
import { wholePercent } from "./job-fraction";
import { latestOf, type LiveJob } from "./live-jobs";
import { progressWords } from "./progress-words";

/** What the statusbar's running-work piece shows (`28` section 7.1, `44` section 4). */
export interface WorkView {
  /** Anything running: the track fills; false draws an empty track and `idle`. */
  readonly active: boolean;
  /** How full the bar is, 0 to 100: the most recently updated job's fraction. Null when the work cannot say how far it is
   *  (a channel build): the bar is full and pulses. */
  readonly percent: number | null;
  /** `2 preparing · 1 syncing`; absent while idle. */
  readonly readout: string | undefined;
  /** The bar's tooltip: the phase and counts of the most recently updated job (`Checking streams 1,204 of 2,598`). */
  readonly tooltip: string;
  /** Stop stops every running job; it is enabled exactly while one runs. */
  readonly stoppable: boolean;
  /** Stop's title while enabled (`Stop syncing`), else why it is disabled. */
  readonly stopText: string;
}

const IDLE: WorkView = {
  active: false,
  percent: null,
  readout: undefined,
  tooltip: STOP_IDLE,
  stoppable: false,
  stopText: STOP_IDLE,
};

/** The view from the build count (`work.preparing`) and the LIVE jobs from the job-progress slice. `work.syncing` is not
 *  read: the bulk runners write it, so a bulk Enable would already show a sync. */
export function workView({ preparing }: Pick<WorkCounts, "preparing">, live: readonly LiveJob[]): WorkView {
  const parts: string[] = [];
  if (preparing > 0) parts.push(`${preparing} preparing`);
  if (live.length > 0) parts.push(`${live.length} syncing`);
  const latest = latestOf(live);
  if (parts.length === 0) return IDLE;
  const percent = latest === undefined ? null : wholePercent(latest.fraction);
  return {
    active: true,
    percent,
    readout: parts.join(" · "),
    tooltip: latest === undefined ? `${preparing} preparing` : `${progressWords(latest.progress)} · ${percent}%`,
    stoppable: latest !== undefined,
    stopText: latest !== undefined ? STOP_SYNCING : STOP_BUILD,
  };
}
