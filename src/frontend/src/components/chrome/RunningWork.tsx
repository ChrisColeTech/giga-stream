import { RunningWork as RunningWorkBar } from "@giga/ui/shell/RunningWork";
import { useScanObserver } from "@/hooks/useScanObserver";
import { cancelJob, listJobs } from "@/services/jobs";
import { useAppStore } from "@/store/app-store";
import { isLive } from "@/types/job";

/** The interface's running work: the store's live jobs built into the shared bar's view, Stop through the fileserver. */
export function RunningWork() {
  useScanObserver();
  const say = useAppStore((state) => state.say);
  const jobs = useAppStore((state) => state.jobs);
  const live = jobs.filter(isLive);
  const running = live[0] ?? null;
  const percent = running?.percent === undefined ? null : Math.max(0, Math.min(100, running.percent));

  const stop = async () => {
    if (running === null) return;
    try {
      useAppStore.getState().upsertJob(await cancelJob(running.id));
      const version = useAppStore.getState().beginJobsRead();
      const jobs = await listJobs();
      useAppStore.getState().acceptJobsRead(version, jobs);
      say("Running work is stopping.");
    } catch (error: unknown) {
      say(error instanceof Error ? error.message : "Could not reach the fileserver.", "warn");
    }
  };

  return (
    <RunningWorkBar
      view={{
        active: running !== null,
        percent,
        readout: running === null ? undefined : `${live.length} running${percent === null ? "" : ` · ${percent}%`}`,
        tooltip: running === null ? "Nothing running" : `${running.label}${percent === null ? "" : ` · ${percent}%`}`,
        stoppable: running !== null,
        stopTitle: running === null ? "Nothing to stop" : `Stop ${running.label.toLowerCase()}`,
      }}
      onStop={() => void stop()}
    />
  );
}
