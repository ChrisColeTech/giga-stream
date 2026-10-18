import type { Store } from "../store/store.js";
import type { ChannelBulkResult } from "../types/channel-bulk.js";
import type { Actor, AuditService } from "./audit-service.js";

/**
 * Bulk enable and disable (docs/43 section 3.3): stream rows only, one transaction, ONE revision, one audit entry.
 * `changed` flipped, `unchanged` were already in that state, `skipped` are live rows or unknown ids. A call that
 * flips nothing takes no revision and writes no audit entry. An id sent twice counts once.
 */
export function createChannelBulk(deps: { store: Store; audit: AuditService }) {
  const { store, audit } = deps;
  return {
    setEnabledMany(ids: readonly string[], enabled: boolean, actor: Actor): ChannelBulkResult {
      const result = store.transaction((): ChannelBulkResult => {
        const answer = { changed: 0, unchanged: 0, skipped: 0 };
        let revision: number | undefined;
        for (const id of new Set(ids)) {
          const record = store.channels.find(id);
          if (record?.kind !== "stream") answer.skipped += 1;
          else if (record.enabled === enabled) answer.unchanged += 1;
          else {
            revision ??= store.revisions.next();
            store.channels.update({ ...record, enabled, revision });
            answer.changed += 1;
          }
        }
        return answer;
      });
      if (result.changed > 0) {
        audit.record(actor, { action: "channel.enabled_bulk", subject: "channels", detail: { enabled, ...result } });
      }
      return result;
    },
  };
}
