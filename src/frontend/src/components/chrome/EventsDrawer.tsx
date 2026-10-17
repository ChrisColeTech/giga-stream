import { EventsDrawer as SharedEventsDrawer } from "@giga/ui/shell/EventsDrawer";
import { useAppStore } from "@/store/app-store";

/** The interface's events drawer: the shared drawer, fed from the store (`06` section 7). The interface's log does not
 *  page, so it gives the drawer no older page and no `Load older` row. */
export function EventsDrawer() {
  const open = useAppStore((state) => state.eventsOpen);
  const events = useAppStore((state) => state.events);
  const clearEvents = useAppStore((state) => state.clearEvents);
  return <SharedEventsDrawer open={open} rows={events} onClear={clearEvents} />;
}
