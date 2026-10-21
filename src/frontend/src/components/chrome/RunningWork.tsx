import { RunningWork as RunningWorkBar } from "@giga/ui/shell/RunningWork";
import { useRunningWork } from "@/hooks/useRunningWork";

/** The interface's running work: the store's live jobs and its own loading flags built into the shared bar's view;
 *  Stop cancels a job through the fileserver, or asks playback to stop (`50` section 2.4). */
export function RunningWork() {
  const { view, stop } = useRunningWork();
  return <RunningWorkBar view={view} onStop={stop} />;
}
