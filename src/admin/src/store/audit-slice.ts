import type { EventRow } from "@giga/ui/lib/event-log";
import { OLDER_AUDIT, OLDER_PAGE_SIZE } from "@/fixtures/audit";
import { eventFromAudit } from "@/lib/event-sentence";
import type { EventArea } from "@/types/events";

/* The Events drawer's paging, a slice of the one store. `Load older` prepends the next page of older audit rows, newest
 * of the older first, each page kept in time order. The fixture build pages through `fixtures/audit.ts`; `29` pages
 * through `GET /api/audit?before=` and keeps this shape. */
export interface AuditSlice {
  /** How many of the older rows `Load older` has brought so far. */
  olderLoaded: number;
  loadOlder: () => void;
}

interface Host {
  events: readonly EventRow<EventArea>[];
}

type Set = (partial: Partial<AuditSlice & Host>) => void;
type Get = () => AuditSlice & Host;

/** Whether there is an older page left to load. */
export const olderRemaining = (loaded: number): boolean => loaded < OLDER_AUDIT.length;

export function auditSlice(set: Set, get: Get): AuditSlice {
  return {
    olderLoaded: 0,
    loadOlder: () => {
      const { olderLoaded, events } = get();
      if (!olderRemaining(olderLoaded)) return;
      const end = OLDER_AUDIT.length - olderLoaded;
      const page = OLDER_AUDIT.slice(Math.max(0, end - OLDER_PAGE_SIZE), end).map((entry) => eventFromAudit(entry));
      /* Prepended whole, as the mockup does: the 200-row cap trims the front at the next appended row, never the page. */
      set({ events: [...page, ...events], olderLoaded: olderLoaded + page.length });
    },
  };
}
