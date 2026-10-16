import path from "node:path";

import type { Store } from "../store/store.ts";
import { createChannelRuntime } from "./channel-runtime.ts";
import { createChannelService } from "./channel-service.ts";
import { createFaultState, type Fault } from "./fault-state.ts";
import { createStreamService } from "./stream-service.ts";

export interface ServiceOptions {
  cacheDir: string;
  dataDir: string;
  ffmpegPath: string;
  now: () => number;
  log: (line: string) => void;
  /** Overrides the fault delay's sleep in tests. */
  sleep?: (ms: number) => Promise<void>;
}

/** The services composition root: one runtime, one fault state, and the services the routes call. */
export function createServices(store: Store, options: ServiceOptions) {
  const { cacheDir, dataDir, ffmpegPath, now, log, sleep } = options;
  const runtime = createChannelRuntime({
    cacheRoot: path.join(cacheDir, "items"),
    encodeRoot: path.join(dataDir, "encode"),
    ffmpegPath,
    clock: now,
    log,
  });
  const faults = createFaultState(now);
  const channels = createChannelService(store, runtime, faults, now);
  const stream = createStreamService(runtime, faults, channels.exists, sleep);
  return {
    channels,
    stream,
    faults: {
      set(id: string, fault: Fault, durationMs?: number, delayMs?: number) {
        channels.get(id, "");
        faults.set(id, fault, durationMs, delayMs);
        return { id, fault: faults.describe(id) };
      },
      clear(id: string) {
        channels.get(id, "");
        faults.clear(id);
        return { id, fault: null };
      },
    },
    health: () => ({ role: "live-server", channels: channels.count() }),
    settled: () => runtime.settled(),
    stop: () => runtime.stopAll(),
  };
}

export type Services = ReturnType<typeof createServices>;
