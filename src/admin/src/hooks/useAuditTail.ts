import { useMemo } from "react";
import { audit } from "@/services/audit";
import { createAuditTail, type AuditTail } from "@/services/audit-tail";
import { useAppStore } from "@/store/app-store";

/** The Events drawer's audit reads: `reload` (after sign-in, a list Refresh, a write of the page's own) and `loadOlder`.
 *  The service call, the merge and the stale-answer check are `services/audit-tail.ts`; the store only takes the rows. */
export function useAuditTail(): AuditTail {
  return useMemo(() => createAuditTail({ service: audit, store: () => useAppStore.getState() }), []);
}
