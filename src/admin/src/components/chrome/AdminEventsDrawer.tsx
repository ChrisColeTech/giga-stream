import { EventsDrawer } from "@giga/ui/shell/EventsDrawer";
import { useAppStore } from "@/store/app-store";
import { useOlderAvailable } from "@/store/selectors";

/** The admin's Events drawer: the library drawer fed from the store's rows (the audit log and the page's own), with the
 *  `Load older` row at the top, disabled when no older page is left. `Clear` empties the list on screen only. */
export function AdminEventsDrawer() {
  const open = useAppStore((state) => state.eventsOpen);
  const events = useAppStore((state) => state.events);
  const clearEvents = useAppStore((state) => state.clearEvents);
  const loadOlder = useAppStore((state) => state.loadOlder);
  const available = useOlderAvailable();

  return <EventsDrawer open={open} rows={events} onClear={clearEvents} older={{ available, onLoad: loadOlder }} />;
}
