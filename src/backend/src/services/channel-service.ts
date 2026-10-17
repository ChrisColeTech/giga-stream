import { randomUUID } from "node:crypto";

import { AppError, ERRORS } from "../constants/errors.js";
import type { ChannelRecord } from "../store/channel-repository.js";
import type { Store } from "../store/store.js";
import type { BackendChannel, ChannelInput, ChannelList, ChannelPatch } from "../types/channel.js";
import { addressRefusal, isAcceptedAddress } from "./address-rule.js";
import type { Actor, AuditService } from "./audit-service.js";

const invalid = (field: string, message: string): AppError =>
  new AppError(ERRORS.channelInvalid, { field }, message);

/**
 * The channels (docs/03 section 7.2). Every change is live as soon as it is saved: it raises the one
 * revision in the same transaction. Nothing is pushed: a reader learns of a change from the revision in the next
 * answer it reads (`01` section 4.4).
 */
export function createChannelService(deps: {
  store: Store;
  audit: AuditService;
  allowLoopback: boolean;
  now: () => number;
}) {
  const { store, audit, allowLoopback, now } = deps;

  function checkAddresses(record: ChannelRecord): void {
    if (!isAcceptedAddress(record.streamUrl, allowLoopback)) {
      throw invalid("streamUrl", addressRefusal("stream address", allowLoopback));
    }
    if (record.logoUrl !== null && !isAcceptedAddress(record.logoUrl, allowLoopback)) {
      throw invalid("logoUrl", addressRefusal("logo address", allowLoopback));
    }
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
        tvgId: null, // a hand-created row is never owned by the playlist sync (docs/03 section 7.2c)
        source: null,
        streamUrl: input.streamUrl,
        revision: 0,
      };
      checkAddresses(record);
      store.transaction(() => {
        store.channels.insert({ ...record, revision: store.revisions.next() }, now());
      });
      audit.record(actor, { action: "channel.created", subject: id, detail: { name: record.name } });
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
        tvgId: current.tvgId ?? null,
        source: current.source ?? null,
        streamUrl: patch.streamUrl ?? current.streamUrl,
        revision: current.revision,
      };
      checkAddresses(record);
      store.transaction(() => {
        store.channels.update({ ...record, revision: store.revisions.next() });
      });
      audit.record(actor, { action: "channel.updated", subject: id, detail: { fields: Object.keys(patch) } });
      return existing(id);
    },

    remove(id: string, actor: Actor): { id: string } {
      const current = existing(id);
      store.transaction(() => {
        store.channels.remove(id);
        store.revisions.next();
      });
      audit.record(actor, { action: "channel.deleted", subject: id, detail: { name: current.name } });
      return { id };
    },

    isEmpty: (): boolean => store.channels.isEmpty(),
  };
}

export type ChannelService = ReturnType<typeof createChannelService>;
