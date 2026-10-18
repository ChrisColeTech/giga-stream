import { RunningWork } from "@giga/ui/shell/RunningWork";
import { Statusbar } from "@giga/ui/shell/Statusbar";
import { useStopSyncing } from "@/hooks/useStopSyncing";
import { workView } from "@/lib/running-work";
import { useAppStore } from "@/store/app-store";

/** The admin's statusbar: the running work (the bar that follows the most recently updated job, `N syncing`, and a `Stop`
 *  that stops every running job - all read from the job-progress slice, `44` section 4), the ONE notice line, and the
 *  Events and Settings doors. A notice appears when something says one, and not before. The shared `RunningWork` draws
 *  `workView`'s output (`50` section 2.2): `stopText` is Stop's title while a job runs, its disabled reason while not. */
export function AdminStatusbar() {
  const preparing = useAppStore((state) => state.work.preparing);
  const live = useAppStore((state) => state.jobProgress.live);
  const notice = useAppStore((state) => state.notice);
  const eventsOpen = useAppStore((state) => state.eventsOpen);
  const toggleEvents = useAppStore((state) => state.toggleEvents);
  const openOverlay = useAppStore((state) => state.openOverlay);
  const stopSyncing = useStopSyncing();
  const view = workView({ preparing }, live);

  return (
    <Statusbar
      running={
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
          onStop={() => void stopSyncing()}
        />
      }
      notice={notice}
      events={{ open: eventsOpen, onToggle: toggleEvents }}
      onSettings={() => openOverlay("settings")}
    />
  );
}
