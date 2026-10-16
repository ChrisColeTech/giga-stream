import { statSync } from "node:fs";

import { AppError, ERRORS } from "../constants/errors.ts";
import { DEFAULT_VARIANTS } from "../constants/media.ts";
import type { Store } from "../store/store.ts";
import type { Channel, ChannelInput, ChannelPatch, ChannelView } from "../types/channel.ts";
import type { ChannelRuntime } from "./channel-runtime.ts";
import type { FaultState } from "./fault-state.ts";

const isDirectory = (file: string) => statSync(file, { throwIfNoEntry: false })?.isDirectory() ?? false;
const isFile = (file: string) => statSync(file, { throwIfNoEntry: false })?.isFile() ?? false;

function invalid(field: string, sentence: string): AppError {
  return new AppError(ERRORS.channelInvalid, { field }, sentence);
}

/** What can be checked at once, so a bad path is refused instead of saved as a failing channel. */
function checkSource(channel: Channel): void {
  if (channel.folder !== undefined && !isDirectory(channel.folder)) {
    throw invalid("folder", "That folder does not exist.");
  }
  const missing = (channel.videos ?? []).findIndex((file) => !isFile(file));
  if (missing !== -1) throw invalid(`videos.${missing}`, `${channel.videos?.[missing]} does not exist.`);
}

/**
 * The channels (docs/10 section 3.1): CRUD over the store, each change live at once — the runtime rebuilds
 * the channel in the background and its state says how far it got. `base` is the address the caller used,
 * so the stream and logo addresses in an answer work from where it was asked.
 */
export function createChannelService(store: Store, runtime: ChannelRuntime, faults: FaultState, clock: () => number) {
  function view(channel: Channel, base: string): ChannelView {
    const { createdAt: _created, updatedAt: _updated, ...fields } = channel;
    return {
      ...fields,
      masterUrl: `${base}/live/${channel.id}/master.m3u8`,
      logoUrl: `${base}/logos/${channel.id}.png`,
      ...runtime.status(channel.id),
      fault: faults.describe(channel.id)?.fault ?? null,
    };
  }

  function existing(id: string): Channel {
    const channel = store.channels.find(id);
    if (!channel) throw new AppError(ERRORS.channelNotFound, { id });
    return channel;
  }

  function claimNumber(number: number, id: string): void {
    const holder = store.channels.numberHolder(number);
    if (holder !== undefined && holder !== id) throw new AppError(ERRORS.channelTaken, { field: "number", holder });
  }

  return {
    list: (base: string): ChannelView[] => store.channels.list().map((channel) => view(channel, base)),
    get: (id: string, base: string): ChannelView => view(existing(id), base),
    exists: (id: string): boolean => store.channels.find(id) !== undefined,
    count: (): number => store.channels.list().length,
    /** Starts every saved channel (the server's start). */
    startAll(): void {
      for (const channel of store.channels.list()) runtime.apply(channel);
    },
    create(input: ChannelInput, base: string): ChannelView {
      if (store.channels.find(input.id)) throw new AppError(ERRORS.channelTaken, { field: "id" });
      claimNumber(input.number, input.id);
      const at = clock();
      const { folder, videos, ...fields } = input;
      const channel: Channel = {
        ...fields,
        ...(folder !== undefined && { folder }),
        ...(videos !== undefined && { videos }),
        mode: input.mode ?? "loop",
        captions: input.captions ?? false,
        variants: input.variants ?? DEFAULT_VARIANTS,
        createdAt: at,
        updatedAt: at,
      };
      checkSource(channel);
      store.transaction(() => store.channels.insert(channel));
      runtime.apply(channel);
      return view(channel, base);
    },
    update(id: string, patch: ChannelPatch, base: string): ChannelView {
      const before = existing(id);
      if (patch.number !== undefined) claimNumber(patch.number, id);
      // A new source replaces the old one; otherwise the old one stays.
      const newSource = patch.folder !== undefined || patch.videos !== undefined;
      const folder = newSource ? patch.folder : before.folder;
      const videos = newSource ? patch.videos : before.videos;
      const channel: Channel = {
        id,
        name: patch.name ?? before.name,
        category: patch.category ?? before.category,
        number: patch.number ?? before.number,
        mode: patch.mode ?? before.mode,
        captions: patch.captions ?? before.captions,
        variants: patch.variants ?? before.variants,
        ...(folder !== undefined && { folder }),
        ...(videos !== undefined && { videos }),
        createdAt: before.createdAt,
        updatedAt: clock(),
      };
      checkSource(channel);
      store.transaction(() => store.channels.update(channel));
      runtime.apply(channel);
      return view(channel, base);
    },
    async remove(id: string): Promise<{ id: string }> {
      existing(id);
      store.transaction(() => store.channels.remove(id));
      faults.clear(id);
      await runtime.remove(id);
      return { id };
    },
  };
}

export type ChannelService = ReturnType<typeof createChannelService>;
