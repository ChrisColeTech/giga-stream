import { randomUUID } from "node:crypto";

import { AppError, ERRORS } from "../constants/errors.js";
import type { ChannelRecord } from "../store/channel-repository.js";
import type { Store } from "../store/store.js";
import type { BackendChannel, ChannelInput, ChannelList, ChannelPatch } from "../types/channel.js";
import type { EventSink } from "../types/events.js";
import { addressRefusal, isAcceptedAddress } from "./address-rule.js";
import type { Actor, AuditService } from "./audit-service.js";

const invalid = (field: string, message: string): AppError =>
  new AppError(ERRORS.channelInvalid, { field }, message);

/**
 * The channels (docs/03 section 7.2). Every change is live as soon as it is saved: it raises the one
 * revision in the same transaction and is announced on the socket after it commits.
 */
export function createChannelService(deps: {
  store: Store;
  events: EventSink;
  audit: AuditService;
  allowLoopback: boolean;
  now: () => number;
}) {
  const { store, events, audit, allowLoopback, now } = deps;

  function checkAddresses(record: ChannelRecord): void {
    if (!isAcceptedAddress(record.streamUrl, allowLoopback)) {
      throw invalid("streamUrl", addressRefusal("stream address", allowLoopback));
    }
    if (record.logoUrl !== null && !isAcceptedAddress(record.logoUrl, allowLoopback)) {
      throw invalid("logoUrl", addressRefusal("logo address", allowLoopback));
    }
  }

  function announce(revision: number): void {
    events.publish({ type: "channels.changed", data: { revision } });
  }

  function existing(id: string): BackendChannel {
    const found = store.channels.find(id);
    if (!found) throw new AppError(ERRORS.channelNotFound);
    return found;
  }

  return {
    list(): ChannelList {
      return { items: store.channels.list(), revision: store.revisions.current() };
    },

    get: (id: string): BackendChannel => existing(id),

    /** `id` is given only by the seed; an admin's channel gets a minted one. */
    create(input: ChannelInput, actor: Actor, id: string = `ch_${randomUUID()}`): BackendChannel {
      const record: ChannelRecord = {
        id,
        name: input.name,
        category: input.category,
        number: input.number ?? null,
        logoUrl: input.logoUrl ?? null,
        streamUrl: input.streamUrl,
        revision: 0,
      };
      checkAddresses(record);
      const revision = store.transaction(() => {
        const next = store.revisions.next();
        store.channels.insert({ ...record, revision: next }, now());
        return next;
      });
      audit.record(actor, { action: "channel.created", subject: id, detail: { name: record.name } });
      announce(revision);
      return existing(id);
    },

    update(id: string, patch: ChannelPatch, actor: Actor): BackendChannel {
      const current = existing(id);
      const record: ChannelRecord = {
        id,
        name: patch.name ?? current.name,
        category: patch.category ?? current.category,
        number: patch.number ?? current.number ?? null,
        logoUrl: patch.logoUrl ?? current.logoUrl ?? null,
        streamUrl: patch.streamUrl ?? current.streamUrl,
        revision: current.revision,
      };
      checkAddresses(record);
      const revision = store.transaction(() => {
        const next = store.revisions.next();
        store.channels.update({ ...record, revision: next });
        return next;
      });
      audit.record(actor, { action: "channel.updated", subject: id, detail: { fields: Object.keys(patch) } });
      announce(revision);
      return existing(id);
    },

    remove(id: string, actor: Actor): { id: string } {
      const current = existing(id);
      const revision = store.transaction(() => {
        store.channels.remove(id);
        return store.revisions.next();
      });
      audit.record(actor, { action: "channel.deleted", subject: id, detail: { name: current.name } });
      announce(revision);
      return { id };
    },

    isEmpty: (): boolean => store.channels.isEmpty(),
  };
}

export type ChannelService = ReturnType<typeof createChannelService>;
