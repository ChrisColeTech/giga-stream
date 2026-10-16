import path from "node:path";

import { createEncoderChannel } from "../stream/encoder-channel.ts";
import { createLoopChannel } from "../stream/loop-channel.ts";
import { loadSchedule } from "../stream/loop-source.ts";
import type { Channel, ChannelState, PlaylistEntry } from "../types/channel.ts";
import type { StreamBackend } from "../types/stream.ts";
import { findChannelVideos } from "./channel-videos.ts";

export interface RuntimeOptions {
  /** Loop mode's encoded videos, shared by every channel. */
  cacheRoot: string;
  /** Encode mode's live windows and inputs, one folder per channel run. */
  encodeRoot: string;
  ffmpegPath: string;
  clock: () => number;
  log: (line: string) => void;
}

export interface RuntimeStatus {
  state: ChannelState;
  problem?: string;
  renditions: string[];
  playlist: PlaylistEntry[];
  nowPlaying: { index: number; name: string } | null;
}

interface Slot {
  generation: number;
  backend: StreamBackend | null;
  preparing: boolean;
  problem?: string;
  abort?: AbortController;
  work: Promise<void>;
}

/**
 * The running channels. `apply` (re)builds a channel from its saved fields in the background: it finds and
 * reads the videos, encodes what is not cached, starts the stream and only then swaps it in, so an edited
 * channel keeps playing its old stream until the new one is ready. A newer apply or a removal supersedes
 * one in progress. A build that fails leaves the channel `failed` with the reason.
 */
export function createChannelRuntime(options: RuntimeOptions) {
  const { cacheRoot, encodeRoot, ffmpegPath, clock, log } = options;
  const slots = new Map<string, Slot>();

  async function build(channel: Channel, generation: number, signal: AbortSignal): Promise<StreamBackend> {
    const items = await findChannelVideos(channel, signal);
    const backend = channel.mode === "loop"
      ? createLoopChannel(await loadSchedule(channel, items, cacheRoot, ffmpegPath), { clock })
      : createEncoderChannel(channel, items, {
          outDir: path.join(encodeRoot, `${channel.id}-${generation}`, "live"),
          inputsDir: path.join(encodeRoot, `${channel.id}-${generation}`, "inputs"),
          ffmpegPath,
          now: clock,
        });
    await backend.start();
    return backend;
  }

  async function run(id: string, channel: Channel, slot: Slot, generation: number, signal: AbortSignal) {
    try {
      const backend = await build(channel, generation, signal);
      if (slots.get(id) !== slot || slot.generation !== generation) return void (await backend.stop());
      const old = slot.backend;
      slot.backend = backend;
      slot.preparing = false;
      delete slot.problem;
      await old?.stop();
    } catch (error) {
      if (slots.get(id) !== slot || slot.generation !== generation) return;
      const old = slot.backend;
      slot.backend = null;
      slot.preparing = false;
      slot.problem = error instanceof Error ? error.message : String(error);
      log(`${id}: ${slot.problem}`);
      await old?.stop();
    }
  }

  async function remove(id: string): Promise<void> {
    const slot = slots.get(id);
    if (!slot) return;
    slots.delete(id);
    slot.abort?.abort();
    await slot.backend?.stop();
  }

  return {
    apply(channel: Channel): void {
      const slot = slots.get(channel.id) ?? { generation: 0, backend: null, preparing: false, work: Promise.resolve() };
      slots.set(channel.id, slot);
      slot.abort?.abort();
      const abort = new AbortController();
      slot.abort = abort;
      slot.generation += 1;
      slot.preparing = true;
      slot.work = run(channel.id, channel, slot, slot.generation, abort.signal);
    },
    remove,
    /** The stream a request reads, while there is one. */
    backend: (id: string): StreamBackend | null => slots.get(id)?.backend ?? null,
    status(id: string): RuntimeStatus {
      const slot = slots.get(id);
      const backend = slot?.backend ?? null;
      const state: ChannelState = slot?.preparing ? "preparing" : slot?.problem ? "failed" : (backend?.state() ?? "stopped");
      return {
        state,
        ...(slot?.problem !== undefined && !slot.preparing && { problem: slot.problem }),
        renditions: backend?.renditions() ?? [],
        playlist: backend?.playlist() ?? [],
        nowPlaying: backend?.nowPlaying() ?? null,
      };
    },
    /** Resolves once every apply in progress has finished (the tests' and the start's wait). */
    async settled(): Promise<void> {
      let pending = [...slots.values()].map((slot) => slot.work);
      while (pending.length > 0) {
        await Promise.all(pending);
        const done = pending;
        pending = [...slots.values()].map((slot) => slot.work).filter((work) => !done.includes(work));
      }
    },
    stopAll: (): Promise<void> => Promise.all([...slots.keys()].map(remove)).then(() => undefined),
  };
}

export type ChannelRuntime = ReturnType<typeof createChannelRuntime>;
