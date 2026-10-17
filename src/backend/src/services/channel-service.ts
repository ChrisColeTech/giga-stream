import { randomUUID } from "node:crypto";

import { AppError, ERRORS } from "../constants/errors.js";
import type { Fault } from "../live/engine/fault-state.js";
import type { LiveEngine } from "../live/engine/live-engine.js";
import type { Store } from "../store/store.js";
import type {
  AdminChannel,
  AdminChannelList,
  BackendChannel,
  ChannelList,
  ChannelRecord,
  LiveRecord,
} from "../types/channel.js";
import type { ChannelInput, ChannelPatch } from "../types/channel-input.js";
import type { Actor, AuditService } from "./audit-service.js";
import { adminChannel, liveSpecOf, publicChannel } from "./channel-views.js";
import { checkLiveSource, newLiveRecord, patchedLiveRecord } from "./live-channel-rules.js";
import { invalid, newStreamRecord, patchedStreamRecord, withEdits } from "./stream-channel-rules.js";

/**
 * The channels of both kinds (docs/03 section 7.2, docs/26 section 3.3). Every change is live as soon as it
 * is saved: it raises the one revision in the same transaction, and a live row's engine rebuilds it in the
 * background (its state says how far it got). Nothing is pushed: a reader learns of a change from the
 * revision in the next answer it reads (`01` section 4.4).
 */
export function createChannelService(deps: {
  store: Store;
  audit: AuditService;
  live: LiveEngine;
  allowLoopback: boolean;
  now: () => number;
}) {
  const { store, audit, live, allowLoopback, now } = deps;

  function existing(id: string): ChannelRecord {
    const found = store.channels.find(id);
    if (!found) throw new AppError(ERRORS.channelNotFound);
    return found;
  }

  function existingLive(id: string): LiveRecord {
    const found = existing(id);
    if (found.kind !== "live") throw invalid("kind", "That is a stream channel; this applies to live channels only.");
    return found;
  }

  /** A live number is unique among live rows. */
  function claimNumber(record: LiveRecord): void {
    const holder = record.number === null ? undefined : store.channels.liveNumberHolder(record.number);
    if (holder !== undefined && holder !== record.id) throw new AppError(ERRORS.channelTaken, { field: "number", holder });
  }

  function createRecord(input: ChannelInput): ChannelRecord {
    if (input.kind === "stream") return newStreamRecord(input, `ch_${randomUUID()}`, allowLoopback);
    if (store.channels.find(input.id)) throw new AppError(ERRORS.channelTaken, { field: "id" });
    const record = newLiveRecord(input);
    claimNumber(record);
    checkLiveSource(record.live);
    return record;
  }

  return {
    list: (base: string): ChannelList => ({
      items: store.channels.list().map((record) => publicChannel(record, base)),
      revision: store.revisions.current(),
    }),

    get: (id: string, base: string): BackendChannel => publicChannel(existing(id), base),

    /** The admin's full view: both kinds, with a live row's state, playlist and fault. */
    listAdmin: (base: string): AdminChannelList => ({
      items: store.channels.list().map((record) => adminChannel(record, base, live)),
      revision: store.revisions.current(),
    }),

    create(input: ChannelInput, actor: Actor, base: string): AdminChannel {
      const record = createRecord(input);
      store.transaction(() => store.channels.insert({ ...record, revision: store.revisions.next() }, now()));
      audit.record(actor, { action: "channel.created", subject: record.id, detail: { name: record.name, kind: record.kind } });
      const saved = existing(record.id);
      if (saved.kind === "live") live.apply(liveSpecOf(saved));
      return adminChannel(saved, base, live);
    },

    update(id: string, patch: ChannelPatch, actor: Actor, base: string): AdminChannel {
      const current = existing(id);
      if (patch.kind !== undefined && patch.kind !== current.kind) {
        throw invalid("kind", "A channel's kind cannot be changed.");
      }
      let record: ChannelRecord;
      if (current.kind === "stream") {
        record = withEdits(current, patchedStreamRecord(current, patch, allowLoopback));
      } else {
        const next = patchedLiveRecord(current, patch);
        claimNumber(next);
        checkLiveSource(next.live);
        record = next;
      }
      store.transaction(() => store.channels.update({ ...record, revision: store.revisions.next() }));
      audit.record(actor, { action: "channel.updated", subject: id, detail: { fields: Object.keys(patch) } });
      const saved = existing(id);
      if (saved.kind === "live") live.apply(liveSpecOf(saved));
      return adminChannel(saved, base, live);
    },

    /** Stops a live row's runtime first, then deletes the row. */
    async remove(id: string, actor: Actor): Promise<{ id: string }> {
      const current = existing(id);
      if (current.kind === "live") await live.remove(id);
      store.transaction(() => {
        store.channels.remove(id);
        store.revisions.next();
        // A deleted synced row must not come back with the next sync (docs/26 section 3.10, rule 4).
        if (current.kind === "stream" && current.source !== null) {
          store.tombstones.addChannel(
            { host: current.source, tvgId: current.tvgId, syncName: current.syncName ?? current.name, label: current.name },
            now(),
          );
        }
      });
      audit.record(actor, { action: "channel.deleted", subject: id, detail: { name: current.name, kind: current.kind } });
      return { id };
    },

    /**
     * Forgets an admin's edits to a synced row: the next sync supplies the values again (docs/26 section 3.10,
     * rule 5). Nothing the readers see changes at once, so the revision stays.
     */
    revert(id: string, actor: Actor, base: string): AdminChannel {
      const current = existing(id);
      if (current.kind !== "stream" || current.source === null) {
        throw invalid("source", "Only a channel the playlist sync owns can be reverted.");
      }
      store.transaction(() => store.channels.update({ ...current, editedFields: [] }));
      audit.record(actor, { action: "channel.reverted", subject: id, detail: { fields: current.editedFields } });
      return adminChannel(existing(id), base, live);
    },

    /** Re-reads a folder source and rebuilds the channel; the old stream keeps playing until the new is ready. */
    rebuild(id: string, actor: Actor, base: string): AdminChannel {
      const current = existingLive(id);
      checkLiveSource(current.live);
      live.apply(liveSpecOf(current));
      audit.record(actor, { action: "channel.rebuilt", subject: id });
      return adminChannel(current, base, live);
    },

    /** Faults are an in-memory test tool on a live channel (docs/10 section 2, item 5). */
    setFault(id: string, fault: Fault, durationMs: number | undefined, delayMs: number | undefined, actor: Actor) {
      existingLive(id);
      const described = live.setFault(id, fault, durationMs, delayMs);
      audit.record(actor, { action: "channel.fault_set", subject: id, detail: { fault } });
      return { id, fault: described };
    },

    clearFault(id: string, actor: Actor) {
      existingLive(id);
      live.clearFault(id);
      audit.record(actor, { action: "channel.fault_cleared", subject: id });
      return { id, fault: null };
    },

    isEmpty: (): boolean => store.channels.isEmpty(),

    /** The start: every saved live row builds in the background, so the server answers at once. */
    startLive(): void {
      for (const record of store.channels.list()) if (record.kind === "live") live.apply(liveSpecOf(record));
    },
  };
}

export type ChannelService = ReturnType<typeof createChannelService>;
