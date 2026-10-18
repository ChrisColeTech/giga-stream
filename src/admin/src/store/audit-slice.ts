import { ApiError } from "@giga/http/api-error";
import type { EventRow, EventTone } from "@giga/ui/lib/event-log";
import { eventFromAudit } from "@/lib/event-sentence";
import { audit } from "@/services/audit";
import type { AuditList } from "@/services/schemas/audit-schema";
import type { EventArea } from "@/types/events";

/* The Events drawer's history, a slice of the one store (`29` section 11). The rows come from the audit SERVICE: the
 * newest page after sign-in (`loadAudit`) and, on `Load older`, the page before the cursor. The backend answers newest
 * first; the drawer keeps oldest first, so a page is reversed and prepended whole. A refusal (the service is not connected
 * yet, the backend is down) is one warn row and notice and changes nothing else. `olderCursor` is the `before` of the next
 * page, or null when there is none, which keeps `Load older` disabled. */
export interface AuditSlice {
  olderCursor: number | null;
  /** Reads the newest page; called once after a sign-in. */
  loadAudit: () => Promise<void>;
  loadOlder: () => Promise<void>;
}

interface Host {
  events: readonly EventRow<EventArea>[];
  say: (sentence: string, tone?: EventTone, area?: EventArea) => void;
}

type Set = (partial: Partial<AuditSlice & Host>) => void;
type Get = () => AuditSlice & Host;

const REFUSED = "The history could not be read.";

export function auditSlice(set: Set, get: Get): AuditSlice {
  const take = (page: AuditList): void => {
    const rows = [...page.items].reverse().map((entry) => eventFromAudit(entry));
    set({ events: [...rows, ...get().events], olderCursor: page.nextBefore ?? null });
  };
  const refuse = (error: unknown): void => {
    get().say(error instanceof ApiError ? error.message : REFUSED, "warn", "Connection");
  };
  return {
    olderCursor: null,
    loadAudit: async () => {
      try {
        take(await audit.list());
      } catch (error: unknown) {
        refuse(error);
      }
    },
    loadOlder: async () => {
      const before = get().olderCursor;
      if (before === null) return;
      try {
        take(await audit.list({ before }));
      } catch (error: unknown) {
        refuse(error);
      }
    },
  };
}
