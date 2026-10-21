import { AppError, ERRORS } from "../constants/errors.js";
import type { Fault } from "../live/engine/fault-state.js";
import type { LiveEngine } from "../live/engine/live-engine.js";
import type { Store } from "../store/store.js";
import type { Actor, AuditService } from "./audit-service.js";
import { invalid } from "./stream-channel-rules.js";

/**
 * Faults are an in-memory test tool on a live channel (docs/10 section 2, item 5): the engine holds them, the
 * row is never written, and each is named in the audit log. Split out of the channel service so the write
 * verbs and the test seams stay readable apart.
 */
export function createChannelFaults(deps: { store: Store; audit: AuditService; live: LiveEngine }) {
  const { store, audit, live } = deps;

  async function existingLive(id: string): Promise<string> {
    const found = await store.channels.find(id);
    if (!found) throw new AppError(ERRORS.channelNotFound);
    if (found.kind !== "live") throw invalid("kind", "That is a stream channel; this applies to live channels only.");
    return found.name;
  }

  const named = async (actor: Actor, action: string, id: string, name: string, detail: Record<string, unknown> = {}) =>
    audit.record(actor, { action, subject: id, detail: { name, ...detail } });

  return {
    setFault: async (
      id: string,
      fault: Fault,
      durationMs: number | undefined,
      delayMs: number | undefined,
      actor: Actor,
    ) => {
      const name = await existingLive(id);
      const described = live.setFault(id, fault, durationMs, delayMs);
      await named(actor, "channel.fault_set", id, name, { fault });
      return { id, fault: described };
    },

    clearFault: async (id: string, actor: Actor) => {
      const name = await existingLive(id);
      live.clearFault(id);
      await named(actor, "channel.fault_cleared", id, name);
      return { id, fault: null };
    },
  };
}

export type ChannelFaults = ReturnType<typeof createChannelFaults>;
