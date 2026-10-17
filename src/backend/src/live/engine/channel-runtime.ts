import type { ChannelState, LiveSpec, PlaylistEntry, StreamBackend } from "../../types/live-stream.js";
import { type BackendBuilder, buildStream } from "./channel-builder.js";

export interface RuntimeOptions {
  /** Loop mode's encoded videos, shared by every channel. */
  cacheRoot: string;
  /** Encode mode's live windows and inputs, one folder per channel run. */
  encodeRoot: string;
  ffmpegPath: () => string;
  clock: () => number;
  log: (line: string) => void;
  /** Replaces the real build; tests pass a fake source so no ffmpeg runs. */
  build?: BackendBuilder;
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
 * one in progress. A build that fails leaves the channel `failed` with the reason and never throws out of
 * the runtime: one bad channel cannot take the backend down.
 */
export function createChannelRuntime(options: RuntimeOptions) {
  const { cacheRoot, encodeRoot, ffmpegPath, clock, log, build = buildStream } = options;
  const slots = new Map<string, Slot>();

  async function run(spec: LiveSpec, slot: Slot, generation: number, signal: AbortSignal) {
    const id = spec.id;
    try {
      const backend = await build(spec, { cacheRoot, encodeRoot, ffmpegPath, clock, generation, signal });
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
      await old?.stop().catch(() => undefined);
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
    apply(spec: LiveSpec): void {
      const slot = slots.get(spec.id) ?? { generation: 0, backend: null, preparing: false, work: Promise.resolve() };
      slots.set(spec.id, slot);
      slot.abort?.abort();
      const abort = new AbortController();
      slot.abort = abort;
      slot.generation += 1;
      slot.preparing = true;
      slot.work = run(spec, slot, slot.generation, abort.signal);
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
    /**
     * Shutdown: aborts every build (which kills an encode in flight), stops every stream (which kills an
     * encode-mode ffmpeg tree and removes its output) and waits for the builds to end.
     */
    async stopAll(): Promise<void> {
      const works = [...slots.values()].map((slot) => slot.work);
      await Promise.all([...slots.keys()].map(remove));
      await Promise.allSettled(works);
    },
  };
}

export type ChannelRuntime = ReturnType<typeof createChannelRuntime>;
