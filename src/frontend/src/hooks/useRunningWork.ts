import type { WorkView } from "@giga/ui/shell/RunningWork";
import { runningWorkView, trackedJob, videoPlayingOf } from "@/lib/running-work";
import { cancelJob, listJobs } from "@/services/jobs";
import { useAppStore } from "@/store/app-store";
import { useScanObserver } from "./useScanObserver";

export interface RunningWorkState {
  readonly view: WorkView;
  readonly stop: () => void;
}

/** Connects the statusbar's presentational progress control to jobs, activity and playback. */
export function useRunningWork(): RunningWorkState {
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
    videoPlayingOf(media, playerPaused),
    liveStage === "ready" || liveStage === "loading",
  );
  const stop = (): void => {
    if (running === null) {
      useAppStore.getState().requestStop();
      return;
    }
    void cancelJob(running.id).then((job) => {
      useAppStore.getState().upsertJob(job);
      const version = useAppStore.getState().beginJobsRead();
      return listJobs().then((next) => useAppStore.getState().acceptJobsRead(version, next));
    }).catch((error: unknown) => {
      useAppStore.getState().say(
        error instanceof Error ? error.message : "Could not reach the fileserver.",
        "warn",
      );
    });
  };
  return { view, stop };
}
