import path from "node:path";

import { locateTool } from "../../../../shared/media/dist/ffmpeg/locate-tool.js";
import type { LiveSpec, StreamBackend } from "../../types/live-stream.js";
import { createEncoderChannel } from "../stream/encoder-channel.js";
import { createLoopChannel } from "../stream/loop-channel.js";
import { loadSchedule } from "../stream/loop-source.js";
import { findChannelVideos } from "./channel-videos.js";

/** What building a channel's stream needs to know about where it runs. */
export interface BuildContext {
  /** Loop mode's encoded videos, shared by every channel. */
  cacheRoot: string;
  /** Encode mode's live windows and inputs, one folder per channel run. */
  encodeRoot: string;
  /** The bundled FFmpeg's path; looked up when a build needs it, so a backend with no live channel never does. */
  ffmpegPath: () => string;
  clock: () => number;
  generation: number;
  signal: AbortSignal;
}

/** Builds and starts one channel's stream. The runtime swaps it in only once it resolves. */
export type BackendBuilder = (spec: LiveSpec, context: BuildContext) => Promise<StreamBackend>;

export const defaultFfmpegPath = (): string => locateTool("ffmpeg");

/**
 * The real build: find and read the videos, then either encode what is not cached and serve the schedule
 * (loop mode) or start the real-time encoder (encode mode).
 */
export const buildStream: BackendBuilder = async (spec, context) => {
  const { cacheRoot, encodeRoot, ffmpegPath, clock, generation, signal } = context;
  const items = await findChannelVideos(spec, signal);
  const ffmpeg = ffmpegPath();
  const backend = spec.mode === "loop"
    ? createLoopChannel(await loadSchedule(spec, items, cacheRoot, ffmpeg, signal), { clock })
    : createEncoderChannel(spec, items, {
        outDir: path.join(encodeRoot, `${spec.id}-${generation}`, "live"),
        inputsDir: path.join(encodeRoot, `${spec.id}-${generation}`, "inputs"),
        ffmpegPath: ffmpeg,
        now: clock,
      });
  await backend.start();
  return backend;
};
