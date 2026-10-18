import {
  CHANNEL_GONE,
  channelCreated,
  channelDeleted,
  channelMarked,
  channelPreparing,
  channelReverted,
  channelSaved,
} from "@/constants/channel-copy";
import { createBody, isEmptyBody, patchBody, type NewChannelDraft } from "@/lib/channel-body";
import { checkChannel, newChannelRefusal } from "@/lib/channel-check";
import { draftOf, rebuilds, type ChannelDraft } from "@/lib/channel-draft";
import { channelById } from "@/lib/channel-list";
import { isSynced } from "@/lib/channel-rows";
import type { AdminChannel } from "@/types/admin-channel";
import {
  DROPPED,
  codeOf,
  done,
  refusal,
  rejected,
  stillSession,
  type ChannelFlowDeps,
  type FlowRefused,
  type FlowResult,
} from "./channel-flow-support";
import { createChannelReads, type ChannelReads } from "./channel-reads";
import type { ChannelVerdict } from "./schemas/channel-schema";

export type { FlowResult } from "./channel-flow-support";

/** The list's reads (`channel-reads.ts`: load, refresh, a page, a new query, select all matching) and the writes. */
export interface ChannelFlows extends ChannelReads {
  create: (draft: NewChannelDraft) => Promise<FlowResult>;
  /** Null when nothing changed. */
  save: (id: string, draft: ChannelDraft) => Promise<FlowResult<AdminChannel | null>>;
  remove: (id: string) => Promise<FlowResult>;
  rebuild: (id: string) => Promise<FlowResult>;
  revert: (id: string) => Promise<FlowResult>;
  /** The single-row Enable / Disable (a `PATCH { enabled }` through `save`: its notice, its audit). */
  setEnabled: (id: string, enabled: boolean) => Promise<FlowResult<AdminChannel | null>>;
  /** `Mark live` / `Mark dead` on a stream channel (`36` section 8.1): the row answers with the verdict and the time. */
  mark: (id: string, verdict: ChannelVerdict) => Promise<FlowResult>;
}

const BAD_ANSWER = "backend.bad_response";
const NOT_FOUND = "channel.not_found";

/** The Channels tab's orchestration (`36` section 4, after `35` section 5.4). The store and the service are injected, so a
 *  test drives it with fakes. Each flow records the session's serial before it awaits and writes only if the session is
 *  unchanged after; a failure is said once as a `warn` notice and returned typed, so a form puts a field's refusal
 *  under its row. A write's answer replaces the record by id. Nothing here waits for a build: a `preparing` answer is
 *  shown as it is, and a later read shows `live`. */
export function createChannelFlows(deps: ChannelFlowDeps): ChannelFlows {
  const { service, store } = deps;
  const reads = createChannelReads(deps);
  const read = reads.refresh;

  /** A failed write: said once; an unreadable answer may still have written, and a missing channel is gone, so the list
   *  is read again. */
  function failed(error: unknown): FlowRefused {
    const result = refusal(store(), error);
    const code = codeOf(error);
    if (code === BAD_ANSWER || code === NOT_FOUND) void read();
    return result;
  }

  /** One write over a held channel: the serial guard, the answer applied, the failure said. */
  async function write<T>(id: string, call: (channel: AdminChannel) => Promise<T>, apply: (answer: T, channel: AdminChannel) => T) {
    const channel = channelById(store().channels, id);
    if (channel === undefined) {
      store().closeWorkspace("channels");
      return rejected(store(), CHANNEL_GONE);
    }
    const serial = store().serial;
    try {
      const answer = await call(channel);
      if (!stillSession(store, serial)) return DROPPED;
      return done(apply(answer, channel));
    } catch (error: unknown) {
      if (!stillSession(store, serial)) return DROPPED;
      if (codeOf(error) === NOT_FOUND) {
        store().channelRemove(id);
        if (store().workspaces.channels === id) store().closeWorkspace("channels");
      }
      return failed(error);
    }
  }

  const settled = (channel: AdminChannel, sentence: string): AdminChannel => {
    store().channelUpsert(channel);
    store().say(sentence, "info", "Channel");
    return channel;
  };

  async function create(draft: NewChannelDraft): Promise<FlowResult> {
    const bad = newChannelRefusal(draft);
    if (bad !== null) return rejected(store(), bad.sentence, bad.field);
    const serial = store().serial;
    try {
      const channel = await service.create(createBody(draft));
      if (!stillSession(store, serial)) return DROPPED;
      settled(channel, channel.kind === "live" ? channelPreparing(channel.name) : channelCreated(channel.name));
      return done(undefined);
    } catch (error: unknown) {
      return stillSession(store, serial) ? failed(error) : DROPPED;
    }
  }

  async function save(id: string, draft: ChannelDraft): Promise<FlowResult<AdminChannel | null>> {
    const held = channelById(store().channels, id);
    const bad = checkChannel(draft).refusal;
    if (held !== undefined && isEmptyBody(patchBody(held, draft))) return done(null);
    if (bad !== null) return rejected(store(), bad.sentence, bad.field);
    return write<AdminChannel | null>(
      id,
      (channel) => service.update(id, patchBody(channel, draft)),
      (answer, channel) => {
        if (answer === null) return null;
        const preparing = channel.kind === "live" && draft.kind === "live" && rebuilds(channel, draft);
        return settled(answer, preparing ? channelPreparing(answer.name) : channelSaved(answer.name));
      },
    );
  }

  const remove = async (id: string): Promise<FlowResult> => {
    const result = await write(
      id,
      (channel) => service.remove(id).then(() => channel),
      (channel) => {
        store().channelRemove(id);
        // The positions after the row moved up one: unless every row is loaded, the window reads its pages again.
        const { items, total } = store().channels;
        if (items.length !== (total ?? 0)) store().channelsInvalidate();
        if (store().workspaces.channels === id) store().closeWorkspace("channels");
        if (isSynced(channel)) store().markStale("playlists");
        store().say(channelDeleted(channel.name), "info", "Channel");
        return channel;
      },
    );
    return result.ok ? done(undefined) : result;
  };

  const rebuild = (id: string) => answered(id, () => service.rebuild(id), (channel) => channelPreparing(channel.name));
  const revert = (id: string) => answered(id, () => service.revert(id), (channel) => channelReverted(channel.name));

  const mark = (id: string, verdict: ChannelVerdict) =>
    answered(id, () => service.setStatus(id, verdict), (channel) => channelMarked(channel.name, verdict));

  async function setEnabled(id: string, enabled: boolean): Promise<FlowResult<AdminChannel | null>> {
    const held = channelById(store().channels, id);
    if (held === undefined) return rejected(store(), CHANNEL_GONE);
    return save(id, { ...draftOf(held), enabled });
  }

  async function answered(id: string, call: () => Promise<AdminChannel>, say: (channel: AdminChannel) => string) {
    const result = await write(id, call, (answer) => settled(answer, say(answer)));
    return result.ok ? done(undefined) : result;
  }

  return {
    ...reads,
    create,
    save,
    remove,
    rebuild,
    revert,
    setEnabled,
    mark,
  };
}
