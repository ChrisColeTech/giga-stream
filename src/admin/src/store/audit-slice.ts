import type { EventRow } from "@giga/ui/lib/event-log";
import type { EventArea } from "@/types/events";

/* The Events drawer's history, a slice of the one store (`29` section 11). PURE: the I/O (the audit service, the merge of a
 * page into the held rows) lives in `hooks/useAuditTail.ts` and `services/audit-tail.ts`; this slice only takes the rows
 * they hand it. `olderCursor` is the `nextBefore` of the last page read, or null when there is none, which keeps
 * `Load older` disabled. */
export type AuditMode = "reload" | "older";

export interface AuditSlice {
  olderCursor: number | null;
  /** Replaces the held rows with the merged ones. A reload sets the cursor only when none was read yet; `Load older`
   *  always sets it, so reaching the first entry clears it. */
  takeAudit: (rows: readonly EventRow<EventArea>[], nextBefore: number | null, mode: AuditMode) => void;
}

interface Host {
  events: readonly EventRow<EventArea>[];
}

type Set = (partial: Partial<AuditSlice & Host>) => void;
type Get = () => AuditSlice & Host;

export function auditSlice(set: Set, get: Get): AuditSlice {
  return {
    olderCursor: null,
    takeAudit: (rows, nextBefore, mode) => {
      const cursor = mode === "older" || get().olderCursor === null ? nextBefore : get().olderCursor;
      set({ events: rows, olderCursor: cursor });
    },
  };
}
