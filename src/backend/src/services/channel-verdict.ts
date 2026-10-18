import { AppError, ERRORS } from "../constants/errors.js";
import type { LiveEngine } from "../live/engine/live-engine.js";
import type { Store } from "../store/store.js";
import type { AdminChannel } from "../types/channel.js";
import type { Actor, AuditService } from "./audit-service.js";
import { adminChannel } from "./channel-views.js";

/**
 * A hand-set online or offline verdict on a stream channel's own address, `checkedAt` now (docs/36 section 8.1; the
 * words of docs/51). It writes the sync-owned `status` and `checked_at` only: no revision, no edited field, the row's
 * other columns untouched. The next sync run overwrites it with its own check: the mark is a verdict, not a lock.
 */
export function createChannelVerdict(deps: { store: Store; audit: AuditService; live: LiveEngine; now: () => number }) {
  const { store, audit, live, now } = deps;
  return {
    setStatus(id: string, status: "online" | "offline", actor: Actor, base: string): AdminChannel {
      const current = store.channels.find(id);
      if (!current) throw new AppError(ERRORS.channelNotFound);
      if (current.kind !== "stream") throw new AppError(ERRORS.channelNotStream);
      store.channels.setVerdict(id, status, now());
      const detail = { name: current.name, from: current.status ?? null, to: status };
      audit.record(actor, { action: "channel.status.set", subject: id, detail });
      const saved = store.channels.find(id);
      if (!saved) throw new AppError(ERRORS.channelNotFound);
      return adminChannel(saved, base, live);
    },
  };
}
