import { RunningWork } from "@giga/ui/shell/RunningWork";
import { Statusbar } from "@giga/ui/shell/Statusbar";
import { workView } from "@/lib/running-work";
import { useAppStore } from "@/store/app-store";

/* Stop is always disabled (`WorkView.stopReason` says why), so the handler never runs. */
const NEVER = (): void => undefined;

/** The admin's statusbar: the library bar with the running work (`2 preparing · 1 syncing` over a full pulsing bar, or
 *  `idle` over an empty track, and a Stop that is never available), the ONE notice line, and the Events and Settings
 *  doors. A notice appears when something says one, and not before. */
export function AdminStatusbar() {
  const work = useAppStore((state) => state.work);
  const notice = useAppStore((state) => state.notice);
  const eventsOpen = useAppStore((state) => state.eventsOpen);
  const toggleEvents = useAppStore((state) => state.toggleEvents);
  const openOverlay = useAppStore((state) => state.openOverlay);
  const view = workView(work);

  const running = (
    <RunningWork
      running={view.running}
      liveCount={view.liveCount}
      readout={view.readout}
      stopReason={view.stopReason}
      onStop={NEVER}
    />
  );

  return (
    <Statusbar
      running={running}
      notice={notice}
      events={{ open: eventsOpen, onToggle: toggleEvents }}
      onSettings={() => openOverlay("settings")}
    />
  );
}
