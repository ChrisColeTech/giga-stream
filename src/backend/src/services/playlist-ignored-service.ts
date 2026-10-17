import { AppError, ERRORS } from "../constants/errors.js";
import type { Store } from "../store/store.js";
import type { IgnoredEntry } from "../types/playlist-sync.js";
import type { Actor, AuditService } from "./audit-service.js";

/**
 * The channels an admin deleted from the playlist sync (docs/26 section 3.10, rule 4): the sync skips them, and an
 * admin may list them and restore one, which removes its tombstone so the next sync creates the channel again.
 */
export function createPlaylistIgnored(deps: { store: Store; audit: AuditService }) {
  const { store, audit } = deps;
  return {
    list(): { items: IgnoredEntry[] } {
      return {
        items: store.tombstones.listChannels().map((t) => ({
          id: t.id,
          host: t.host ?? "",
          ...(t.tvgId !== undefined && { tvgId: t.tvgId }),
          ...(t.syncName !== undefined && { syncName: t.syncName }),
          name: t.label,
          createdAt: t.createdAt,
        })),
      };
    },

    restore(id: number, actor: Actor): { id: number } {
      const found = store.tombstones.find(id);
      if (found?.kind !== "channel") throw new AppError(ERRORS.ignoredNotFound, { id });
      store.tombstones.remove(id);
      audit.record(actor, {
        action: "channel.sync_ignored_restored",
        subject: String(id),
        detail: { name: found.label, host: found.host ?? "" },
      });
      return { id };
    },
  };
}

export type PlaylistIgnored = ReturnType<typeof createPlaylistIgnored>;
