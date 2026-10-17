import { Statusbar as StatusbarBar } from "@giga/ui/shell/Statusbar";
import { barTone } from "@/lib/bar-tone";
import { useAppStore } from "@/store/app-store";
import { RunningWork } from "./RunningWork";

/** The interface's statusbar: the store supplies the notice, the events door and Theatre's tone; the shared bar draws it. */
export function Statusbar() {
  const eventsOpen = useAppStore((state) => state.eventsOpen);
  const toggleEvents = useAppStore((state) => state.toggleEvents);
  const openOverlay = useAppStore((state) => state.openOverlay);
  const notice = useAppStore((state) => state.notice);
  const theatre = useAppStore((state) => state.theatre);

  return (
    <StatusbarBar
      tone={barTone(theatre)}
      running={<RunningWork />}
      notice={notice}
      events={{ open: eventsOpen, onToggle: toggleEvents }}
      onSettings={() => openOverlay("settings")}
    />
  );
}
