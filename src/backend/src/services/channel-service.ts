import { randomUUID } from "node:crypto";

import { AppError, ERRORS } from "../constants/errors.js";
import type { LiveEngine } from "../live/engine/live-engine.js";
import type { Store } from "../store/store.js";
import type { AdminChannel, BackendChannel, ChannelList, ChannelRecord, LiveRecord } from "../types/channel.js";
import type { ChannelInput, ChannelPatch, LiveChannelInput } from "../types/channel-input.js";
import type { AdminChannelQuery } from "../types/channel-query.js";
import type { Actor, AuditService } from "./audit-service.js";
import { adminChannels } from "./channel-admin-list.js";
import { createChannelBulk } from "./channel-bulk.js";
import { createChannelFaults } from "./channel-faults.js";
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
  const named = async (
    actor: Actor,
    action: string,
    id: string,
    name: string,
    detail: Record<string, unknown> = {},
  ): Promise<void> => audit.record(actor, { action, subject: id, detail: { name, ...detail } });

  async function existing(id: string): Promise<ChannelRecord> {
    const found = await store.channels.find(id);
    if (!found) throw new AppError(ERRORS.channelNotFound);
    return found;
  }

  async function existingLive(id: string): Promise<LiveRecord> {
    const found = await existing(id);
    if (found.kind !== "live") throw invalid("kind", "That is a stream channel; this applies to live channels only.");
    return found;
  }

  /** A live number is unique among live rows. */
  async function claimNumber(record: LiveRecord): Promise<void> {
    const holder = record.number === null ? undefined : await store.channels.liveNumberHolder(record.number);
    if (holder !== undefined && holder !== record.id) throw new AppError(ERRORS.channelTaken, { field: "number", holder });
  }

  async function createRecord(input: ChannelInput): Promise<ChannelRecord> {
    if (input.kind === "stream") return newStreamRecord(input, `ch_${randomUUID()}`);
    const record = newLiveRecord({ ...input, id: input.id ?? `live-${randomUUID()}` }); // none sent: assigned, docs/36
    if (await store.channels.find(record.id)) throw new AppError(ERRORS.channelTaken, { field: "id" });
    await claimNumber(record);
    checkLiveSource(record.live);
    return record;
  }

  return {
    ...createChannelBulk({ store, audit }),
    ...createChannelVerdict({ store, audit, live, now }),
    ...createChannelFaults({ store, audit, live }),

    /** The public read: a channel that is not published (itself or its playlist disabled) is not in it (docs/43 3.1). */
    list: async (base: string): Promise<ChannelList> => ({
      items: (await store.channels.list()).filter((record) => record.published).map((record) => publicChannel(record, base)),
      revision: await store.revisions.current(),
    }),

    get: async (id: string, base: string): Promise<BackendChannel> => {
      const record = await existing(id);
      if (!record.published) throw new AppError(ERRORS.channelNotFound);
      return publicChannel(record, base);
    },

    /** The admin's full view (both kinds, a live row's state, playlist and fault): whole, or a page (docs/41 3.1). */
    listAdmin: (base: string, query?: AdminChannelQuery) => adminChannels(store, live, base, query),

    /** The admin view of ONE row, by the list's own view code (docs/36 section 8.2): the Preview reads one channel. */
    getAdmin: async (id: string, base: string): Promise<AdminChannel> => adminChannel(await existing(id), base, live),

    async create(input: ChannelInput, actor: Actor, base: string): Promise<AdminChannel> {
      const record = await createRecord(input);
      await store.transaction(async () =>
        store.channels.insert({ ...record, revision: await store.revisions.next() }, now()));
      await named(actor, "channel.created", record.id, record.name, { kind: record.kind });
      const saved = await existing(record.id);
      if (saved.kind === "live") live.apply(liveSpecOf(saved));
      return adminChannel(saved, base, live);
    },

    async update(id: string, patch: ChannelPatch, actor: Actor, base: string): Promise<AdminChannel> {
      const current = await existing(id);
      if (patch.kind !== undefined && patch.kind !== current.kind) {
        throw invalid("kind", "A channel's kind cannot be changed.");
      }
      let record: ChannelRecord;
      if (current.kind === "stream") {
        record = withEdits(current, patchedStreamRecord(current, patch));
      } else {
        const next = patchedLiveRecord(current, patch);
        await claimNumber(next);
        checkLiveSource(next.live);
        record = next;
      }
      const next: ChannelRecord = { ...record, enabled: patch.enabled ?? current.enabled };
      await store.transaction(async () => store.channels.update({ ...next, revision: await store.revisions.next() }));
      await named(actor, "channel.updated", id, next.name, { fields: Object.keys(patch) });
      const saved = await existing(id);
      // A disabled live channel is not running: it stops, and an edit does not start it.
      if (saved.kind === "live") {
        if (saved.enabled) live.apply(liveSpecOf(saved));
        else await live.remove(id);
      }
      return adminChannel(saved, base, live);
    },

    /** Stops a live row's runtime, then deletes the row. A synced row is deleted for real; a sync may add it back. */
    async remove(id: string, actor: Actor): Promise<{ id: string }> {
      const current = await existing(id);
      if (current.kind === "live") await live.remove(id);
      await store.transaction(async () => {
        await store.channels.remove(id);
        await store.revisions.next();
      });
      await named(actor, "channel.deleted", id, current.name, { kind: current.kind });
      return { id };
    },

    /**
     * Forgets an admin's edits to a synced row: the next sync supplies the values again (docs/26 section 3.10,
     * rule 5). Nothing the readers see changes at once, so the revision stays.
     */
    revert: async (id: string, actor: Actor, base: string): Promise<AdminChannel> => {
      const current = await existing(id);
      if (current.kind !== "stream" || current.playlistId === null) {
        throw invalid("playlistId", "Only a channel that belongs to a playlist can be reverted.");
      }
      await store.transaction(() => store.channels.update({ ...current, editedFields: [] }));
      await named(actor, "channel.reverted", id, current.name, { fields: current.editedFields });
      return adminChannel(await existing(id), base, live);
    },

    /** Re-reads a folder source and rebuilds the channel; the old stream keeps playing until the new is ready. */
    rebuild: async (id: string, actor: Actor, base: string): Promise<AdminChannel> => {
      const current = await existingLive(id);
      if (!current.enabled) throw invalid("enabled", "A disabled channel is not running; enable it first.");
      checkLiveSource(current.live);
      live.apply(liveSpecOf(current));
      // The answer is the state at the moment of the apply (a build takes it out of `live`); the audit write
      // awaits, and must not let the answer describe a later state.
      const view = adminChannel(current, base, live);
      await named(actor, "channel.rebuilt", id, current.name);
      return view;
    },

    /** The seed's repair: a stream row becomes the live row `input` describes, same id, one revision. */
    replaceStreamWithLive: async (input: LiveChannelInput, actor: Actor): Promise<void> => {
      if ((await existing(input.id)).kind !== "stream") throw invalid("kind", "Only a stream channel is replaced by a live one.");
      const record = newLiveRecord(input);
      await claimNumber(record);
      checkLiveSource(record.live);
      await store.transaction(async () => {
        await store.channels.remove(input.id);
        await store.channels.insert({ ...record, revision: await store.revisions.next() }, now());
      });
      await named(actor, "channel.updated", input.id, input.name, { fields: ["kind"], from: "stream" });
      live.apply(liveSpecOf({ ...record, revision: (await existing(input.id)).revision }));
    },
    /** The row with this id, if any (the seed's read). */
    peek: (id: string): Promise<ChannelRecord | undefined> => store.channels.find(id),

    isEmpty: (): Promise<boolean> => store.channels.isEmpty(),

    /** The start: every saved live row builds in the background, so the server answers at once. */
    startLive: async (): Promise<void> => {
      for (const record of await store.channels.list()) {
        if (record.kind === "live" && record.enabled) live.apply(liveSpecOf(record));
      }
    },
  };
}

export type ChannelService = ReturnType<typeof createChannelService>;
