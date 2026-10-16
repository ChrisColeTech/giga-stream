import { AUDIT_PAGE_DEFAULT, AUDIT_PAGE_MAX } from "../constants/limits.js";
import type { AuditEntry, AuditWrite } from "../store/audit-repository.js";
import type { Store } from "../store/store.js";
import type { Principal } from "../types/account.js";

/** Who did something, for the log: the signed-in admin, and the address the request came from. */
export interface Actor {
  principal?: Principal;
  address?: string;
}

/** The audit log (docs/03 section 7.13). A password, token or hash is never written to it. */
export function createAuditService(store: Store, now: () => number) {
  return {
    record(actor: Actor, entry: Omit<AuditWrite, "actorId" | "actorEmail" | "address">): void {
      store.audit.append(
        {
          ...entry,
          ...(actor.principal && { actorId: actor.principal.accountId, actorEmail: actor.principal.email }),
          ...(actor.address && { address: actor.address }),
        },
        now(),
      );
    },
    page(limit = AUDIT_PAGE_DEFAULT, before?: number): { items: AuditEntry[]; nextBefore?: number } {
      const size = Math.min(Math.max(limit, 1), AUDIT_PAGE_MAX);
      const items = store.audit.page(before ?? Number.MAX_SAFE_INTEGER, size + 1);
      const more = items.length > size;
      const shown = items.slice(0, size);
      const last = shown.at(-1);
      return { items: shown, ...(more && last && { nextBefore: last.id }) };
    },
  };
}

export type AuditService = ReturnType<typeof createAuditService>;
