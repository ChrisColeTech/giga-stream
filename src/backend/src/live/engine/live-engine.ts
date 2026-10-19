import path from "node:path";

import type { LiveStatus } from "../../types/channel.js";
import type { LiveSpec } from "../../types/live-stream.js";
import { type BackendBuilder, defaultFfmpegPath } from "./channel-builder.js";
import { createChannelRuntime } from "./channel-runtime.js";
import { createFaultState, type Fault } from "./fault-state.js";
import { createStreamService } from "./stream-service.js";

/**
 * Test seams: a fake build so no ffmpeg runs, a fake sleep for the slow-segments fault, another ffmpeg path,
 * and a hook that hands the engine to the test (to wait for the builds, or read a channel's state).
 */
export interface LiveSeams {
  build?: BackendBuilder;
  sleep?: (ms: number) => Promise<void>;
  ffmpegPath?: () => string;
  onEngine?: (engine: LiveEngine) => void;
}

export interface LiveEngineOptions {
  /** Loop mode's encoded videos live under `<cacheDir>/items`. */
  cacheDir: string;
  /** Encode mode's live windows live under `<dataDir>/encode` and are removed when the channel stops. */
  dataDir: string;
  now: () => number;
  log: (line: string) => void;
  /** Whether an id is a live channel in the store (a logo exists for it). */
  knows: (id: string) => Promise<boolean>;
  seams?: LiveSeams;
}

/**
 * The live engine: the running channels, their faults and their bytes. Its state is in memory; the channel
 * rows are in the backend's store, which hands each saved row to `apply` at start and on every change.
 */
export function createLiveEngine(options: LiveEngineOptions) {
  const { cacheDir, dataDir, now, log, knows, seams = {} } = options;
  const runtime = createChannelRuntime({
    cacheRoot: path.join(cacheDir, "items"),
    encodeRoot: path.join(dataDir, "encode"),
    ffmpegPath: seams.ffmpegPath ?? defaultFfmpegPath,
    clock: now,
    log,
    ...(seams.build && { build: seams.build }),
  });
  const faults = createFaultState(now);
  const stream = createStreamService(runtime, faults, knows, seams.sleep);
  return {
    stream,
    /** (Re)builds a channel in the background; the old stream keeps playing until the new one is ready. */
    apply: (spec: LiveSpec): void => runtime.apply(spec),
    remove: async (id: string): Promise<void> => {
      faults.clear(id);
      await runtime.remove(id);
    },
    status: (id: string): LiveStatus => ({ ...runtime.status(id), fault: faults.describe(id)?.fault ?? null }),
    setFault(id: string, fault: Fault, durationMs?: number, delayMs?: number) {
      faults.set(id, fault, durationMs, delayMs);
      return faults.describe(id);
    },
    clearFault: (id: string): void => faults.clear(id),
    /** Resolves once every build in progress has finished (the tests' wait). */
    settled: (): Promise<void> => runtime.settled(),
    /** Shutdown: every stream stopped, every ffmpeg tree killed, no encode-mode output left. */
    stop: (): Promise<void> => runtime.stopAll(),
  };
}

export type LiveEngine = ReturnType<typeof createLiveEngine>;
