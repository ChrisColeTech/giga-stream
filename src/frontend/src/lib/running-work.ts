import type { WorkView } from "@giga/ui/shell/RunningWork";
import type { ActivityFlags } from "@/store/slices/shell-slice";
import { isLive, type Job } from "@/types/job";
import type { PlayerMediaState } from "@/types/player";

export const trackedJob = (jobs: readonly Job[]): Job | null => jobs.filter(isLive)[0] ?? null;

export function videoPlayingOf(media: PlayerMediaState, playerPaused: boolean): boolean {
  return !playerPaused && media.sources.length > 0
    && (media.stage.kind === "ready" || media.stage.kind === "loading");
}

const clampPercent = (percent: number): number => Math.max(0, Math.min(100, percent));
const playbackStop = (playing: boolean) => ({
  stoppable: playing,
  stopTitle: playing ? "Stop playback" : "Nothing to stop",
});

export function runningWorkView(
  jobs: readonly Job[],
  activity: ActivityFlags,
  videoPlaying: boolean,
  livePlaying: boolean,
): WorkView {
  const live = jobs.filter(isLive);
  const running = live[0] ?? null;
  if (running !== null) {
    const percent = running.percent === undefined ? null : clampPercent(running.percent);
    return {
      active: true,
      percent,
      readout: running.state === "cancelling"
        ? "stopping"
        : `${live.length} running${percent === null ? "" : ` · ${percent}%`}`,
      tooltip: `${running.label}${percent === null ? "" : ` · ${percent}%`}`,
      stoppable: true,
      stopTitle: `Stop ${running.label.toLowerCase()}`,
    };
  }
  const stop = playbackStop(videoPlaying || livePlaying);
  if (activity.search) return { ...stop, active: true, percent: null, readout: "Searching titles", tooltip: "Searching titles" };
  if (activity.library) return { ...stop, active: true, percent: null, readout: "Loading library", tooltip: "Loading library" };
  if (activity.video) return { ...stop, active: true, percent: null, readout: "Loading video", tooltip: "Loading video" };
  if (activity.live) return { ...stop, active: true, percent: null, readout: "Starting stream", tooltip: "Starting stream" };
  if (videoPlaying || livePlaying) return { ...stop, active: false, percent: null };
  return { active: false, percent: null, tooltip: "Nothing running", ...stop };
}
