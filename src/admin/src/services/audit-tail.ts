import { ApiError } from "@giga/http/api-error";
import { AUDIT_PAGE, AUDIT_REFUSED } from "@/constants/audit-limits";
import { namesOf } from "@/lib/account-rows";
import { mergeAudit, oldestAuditId, type MergeMode } from "@/lib/audit-merge";
import type { AppState } from "@/store/app-store";
import type { AuditService } from "./audit";

/** The part of the store the tail reads and writes: the held rows and cursor, the accounts' names, the session's serial,
 *  and the two setters. Handed in, so a test drives the tail with a plain object. */
export type AuditTailStore = Pick<AppState, "serial" | "signedIn" | "events" | "olderCursor" | "accounts" | "takeAudit" | "say">;

export interface AuditTail {
  /** Reads the newest page and merges it into the held rows. Never rejects: a refusal is one warn notice. */
  reload: (limit?: number) => Promise<void>;
  /** Reads the page before the oldest audit row held. Does nothing without a cursor. */
  loadOlder: () => Promise<void>;
}

/** The Events drawer's I/O (`35` section 5.5): the audit service in, the merged rows out through the store's pure setter.
 *  An answer that lands after the session ended or changed is dropped. */
export function createAuditTail(deps: {
  readonly service: Pick<AuditService, "list">;
  readonly store: () => AuditTailStore;
}): AuditTail {
  const { service, store } = deps;
  const alive = (serial: number): boolean => store().signedIn && store().serial === serial;

  async function read(mode: MergeMode, limit: number, before?: number): Promise<void> {
    const serial = store().serial;
    try {
      const page = await service.list({ limit, ...(before !== undefined && { before }) });
      if (!alive(serial)) return;
      const now = store();
      const rows = mergeAudit(now.events, page.items, namesOf(now.accounts.items), mode);
      now.takeAudit(rows, page.nextBefore ?? null, mode);
      if (page.unreadable > 0) now.say(`${page.unreadable} history entries could not be read.`, "warn", "Connection");
    } catch (error: unknown) {
      if (alive(serial)) store().say(error instanceof ApiError ? error.message : AUDIT_REFUSED, "warn", "Connection");
    }
  }

  return {
    reload: (limit = AUDIT_PAGE) => read("reload", limit),
    loadOlder: async () => {
      const { olderCursor, events } = store();
      const before = oldestAuditId(events);
      if (olderCursor === null || before === null) return;
      await read("older", AUDIT_PAGE, before);
    },
  };
}
