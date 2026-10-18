import { randomUUID } from "node:crypto";

import { AppError, ERRORS } from "../constants/errors.js";
import type { Fault } from "../live/engine/fault-state.js";
import type { LiveEngine } from "../live/engine/live-engine.js";
import type { Store } from "../store/store.js";
import type { AdminChannel, BackendChannel, ChannelList, ChannelRecord, LiveRecord } from "../types/channel.js";
import type { ChannelInput, ChannelPatch, LiveChannelInput } from "../types/channel-input.js";
import type { AdminChannelQuery } from "../types/channel-query.js";
import type { Actor, AuditService } from "./audit-service.js";
import { adminChannels } from "./channel-admin-list.js";
import { createChannelBulk } from "./channel-bulk.js";
import { createChannelVerdict } from "./channel-verdict.js";
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
  now: () => number;
}) {
  const { store, audit, live, now } = deps;

  /** One audit line about a channel, named: the log shows the channel's name, not only its id (docs/29 B5). */
  const named = (actor: Actor, action: string, id: string, name: string, detail: Record<string, unknown> = {}): void =>
    audit.record(actor, { action, subject: id, detail: { name, ...detail } });

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
    if (input.kind === "stream") return newStreamRecord(input, `ch_${randomUUID()}`);
    const record = newLiveRecord({ ...input, id: input.id ?? `live-${randomUUID()}` }); // none sent: assigned, docs/36
    if (store.channels.find(record.id)) throw new AppError(ERRORS.channelTaken, { field: "id" });
    claimNumber(record);
    checkLiveSource(record.live);
    return record;
  }

  return {
    ...createChannelBulk({ store, audit }),
    ...createChannelVerdict({ store, audit, live, now }),

    /** The public read: a channel that is not published (itself or its playlist disabled) is not in it (docs/43 3.1). */
    list: (base: string): ChannelList => ({
      items: store.channels.list().filter((record) => record.published).map((record) => publicChannel(record, base)),
      revision: store.revisions.current(),
    }),

    get(id: string, base: string): BackendChannel {
      const record = existing(id);
      if (!record.published) throw new AppError(ERRORS.channelNotFound);
      return publicChannel(record, base);
    },

    /** The admin's full view (both kinds, a live row's state, playlist and fault): whole, or a page (docs/41 3.1). */
    listAdmin: (base: string, query?: AdminChannelQuery) => adminChannels(store, live, base, query),

    create(input: ChannelInput, actor: Actor, base: string): AdminChannel {
      const record = createRecord(input);
      store.transaction(() => store.channels.insert({ ...record, revision: store.revisions.next() }, now()));
      named(actor, "channel.created", record.id, record.name, { kind: record.kind });
      const saved = existing(record.id);
      if (saved.kind === "live") live.apply(liveSpecOf(saved));
      return adminChannel(saved, base, live);
    },

    async update(id: string, patch: ChannelPatch, actor: Actor, base: string): Promise<AdminChannel> {
      const current = existing(id);
      if (patch.kind !== undefined && patch.kind !== current.kind) {
        throw invalid("kind", "A channel's kind cannot be changed.");
      }
      let record: ChannelRecord;
      if (current.kind === "stream") {
        record = withEdits(current, patchedStreamRecord(current, patch));
      } else {
        const next = patchedLiveRecord(current, patch);
        claimNumber(next);
        checkLiveSource(next.live);
        record = next;
      }
      const next: ChannelRecord = { ...record, enabled: patch.enabled ?? current.enabled };
      store.transaction(() => store.channels.update({ ...next, revision: store.revisions.next() }));
      named(actor, "channel.updated", id, next.name, { fields: Object.keys(patch) });
      const saved = existing(id);
      // A disabled live channel is not running: it stops, and an edit does not start it.
      if (saved.kind === "live") {
        if (saved.enabled) live.apply(liveSpecOf(saved));
        else await live.remove(id);
      }
      return adminChannel(saved, base, live);
    },

    /** Stops a live row's runtime, then deletes the row. A synced row is deleted for real; a sync may add it back. */
    async remove(id: string, actor: Actor): Promise<{ id: string }> {
      const current = existing(id);
      if (current.kind === "live") await live.remove(id);
      store.transaction(() => {
        store.channels.remove(id);
        store.revisions.next();
      });
      named(actor, "channel.deleted", id, current.name, { kind: current.kind });
      return { id };
    },

    /**
     * Forgets an admin's edits to a synced row: the next sync supplies the values again (docs/26 section 3.10,
     * rule 5). Nothing the readers see changes at once, so the revision stays.
     */
    revert(id: string, actor: Actor, base: string): AdminChannel {
      const current = existing(id);
      if (current.kind !== "stream" || current.playlistId === null) {
        throw invalid("playlistId", "Only a channel that belongs to a playlist can be reverted.");
      }
      store.transaction(() => store.channels.update({ ...current, editedFields: [] }));
      named(actor, "channel.reverted", id, current.name, { fields: current.editedFields });
      return adminChannel(existing(id), base, live);
    },

    /** Re-reads a folder source and rebuilds the channel; the old stream keeps playing until the new is ready. */
    rebuild(id: string, actor: Actor, base: string): AdminChannel {
      const current = existingLive(id);
      if (!current.enabled) throw invalid("enabled", "A disabled channel is not running; enable it first.");
      checkLiveSource(current.live);
      live.apply(liveSpecOf(current));
      named(actor, "channel.rebuilt", id, current.name);
      return adminChannel(current, base, live);
    },

    /** Faults are an in-memory test tool on a live channel (docs/10 section 2, item 5). */
    setFault(id: string, fault: Fault, durationMs: number | undefined, delayMs: number | undefined, actor: Actor) {
      const channel = existingLive(id);
      const described = live.setFault(id, fault, durationMs, delayMs);
      named(actor, "channel.fault_set", id, channel.name, { fault });
      return { id, fault: described };
    },

    clearFault(id: string, actor: Actor) {
      const channel = existingLive(id);
      live.clearFault(id);
      named(actor, "channel.fault_cleared", id, channel.name);
      return { id, fault: null };
    },

    /** The seed's repair: a stream row becomes the live row `input` describes, same id, one revision. */
    replaceStreamWithLive(input: LiveChannelInput, actor: Actor): void {
      if (existing(input.id).kind !== "stream") throw invalid("kind", "Only a stream channel is replaced by a live one.");
      const record = newLiveRecord(input);
      claimNumber(record);
      checkLiveSource(record.live);
      store.transaction(() => {
        store.channels.remove(input.id);
        store.channels.insert({ ...record, revision: store.revisions.next() }, now());
      });
      named(actor, "channel.updated", input.id, input.name, { fields: ["kind"], from: "stream" });
      live.apply(liveSpecOf({ ...record, revision: existing(input.id).revision }));
    },
    /** The row with this id, if any (the seed's read). */
    peek: (id: string): ChannelRecord | undefined => store.channels.find(id),

    isEmpty: (): boolean => store.channels.isEmpty(),

    /** The start: every saved live row builds in the background, so the server answers at once. */
    startLive(): void {
      for (const record of store.channels.list()) if (record.kind === "live" && record.enabled) live.apply(liveSpecOf(record));
    },
  };
}

export type ChannelService = ReturnType<typeof createChannelService>;
