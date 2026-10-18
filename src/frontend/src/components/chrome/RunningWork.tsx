import { RunningWork as RunningWorkBar, type WorkView } from "@giga/ui/shell/RunningWork";
import { useScanObserver } from "@/hooks/useScanObserver";
import { cancelJob, listJobs } from "@/services/jobs";
import { useAppStore } from "@/store/app-store";
import type { ActivityFlags } from "@/store/slices/shell-slice";
import { isLive, type Job } from "@/types/job";

/** The job the bar tracks: the first live one, as before (`50` section 2.3). */
export const trackedJob = (jobs: readonly Job[]): Job | null => jobs.filter(isLive)[0] ?? null;

const clampPercent = (percent: number): number => Math.max(0, Math.min(100, percent));

const playbackStop = (playing: boolean) => ({ stoppable: playing, stopTitle: playing ? "Stop playback" : "Nothing to stop" });

/** The bar's view (`50` section 2.3): a live job wins (determinate, `N running · X%`), then the interface's own work
 *  in the order search, library, video, live — each indeterminate (`percent: null`). At rest the bar is idle. While
 *  the tracked job is being cancelled the readout says `stopping` (the deleted sentence's work, `50` section 2.1);
 *  Stop stays enabled exactly as today's flow, where a cancelling job is still a live one. */
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

/** The interface's running work: the store's live jobs and its own loading flags built into the shared bar's view;
 *  Stop cancels a job through the fileserver, or asks playback to stop (`50` section 2.4). */
export function RunningWork() {
  useScanObserver();
  const jobs = useAppStore((state) => state.jobs);
  const activity = useAppStore((state) => state.activity);
  const media = useAppStore((state) => state.playerMedia);
  const playerPaused = useAppStore((state) => state.playerPaused);
  const liveStage = useAppStore((state) => state.liveStage);
  const running = trackedJob(jobs);
  const view = runningWorkView(
    jobs,
    activity,
    !playerPaused && media.stage.kind === "ready" && media.sources.length > 0,
    liveStage === "ready" || liveStage === "loading",
  );

  const stopJob = async (): Promise<void> => {
    if (running === null) return;
    try {
      useAppStore.getState().upsertJob(await cancelJob(running.id));
      const version = useAppStore.getState().beginJobsRead();
      useAppStore.getState().acceptJobsRead(version, await listJobs());
    } catch (error: unknown) {
      useAppStore.getState().say(error instanceof Error ? error.message : "Could not reach the fileserver.", "warn");
    }
  };

  return (
    <RunningWorkBar
      view={view}
      onStop={() => {
        if (running !== null) void stopJob();
        else useAppStore.getState().requestStop();
      }}
    />
  );
}
