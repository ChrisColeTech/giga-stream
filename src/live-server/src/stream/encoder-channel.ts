import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";

import {
  ENCODER_LOG_LIMIT,
  ENCODER_MAX_FAST_FAILURES,
  ENCODER_STABLE_UPTIME_MS,
  ENCODER_STOP_WAIT_MS,
  SEGMENT_NUMBER_STRIDE,
} from "../constants/media.ts";
import type { ChannelState } from "../types/channel.ts";
import type { PlaylistItem, StreamBackend } from "../types/stream.ts";
import { buildEncoderArgs, type EncoderInputs } from "./encoder-args.ts";
import { writeEncoderInputs } from "./encoder-inputs.ts";
import { isRunning, killProcessTree } from "./process-tree.ts";
import { type RecipeChannel, renditionNames } from "./recipe.ts";

const SAFE_PART = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

interface EncoderOptions {
  /** Where ffmpeg writes the live window; `inputsDir` holds its concat list and joined captions. */
  outDir: string;
  inputsDir: string;
  ffmpegPath: string;
  now?: () => number;
}

/**
 * Encode mode: supervises one real-time ffmpeg that loops the channel's playlist into a live HLS window.
 * States: starting | live | restarting | stopped | failed. An unexpected exit restarts with exponential
 * backoff; five quick failures in a row end in `failed`.
 */
export function createEncoderChannel(channel: RecipeChannel, items: PlaylistItem[], options: EncoderOptions): StreamBackend {
  const { outDir, inputsDir, ffmpegPath, now = Date.now } = options;
  let state: ChannelState = "stopped";
  let child: ChildProcess | null = null;
  let timer: NodeJS.Timeout | null = null;
  let stopping = false;
  let failures = 0;
  let generation = 0;
  let startedAt = 0;
  let log = "";
  let exited: Promise<void> = Promise.resolve();
  let inputs: EncoderInputs | null = null;
  const cycleMs = items.reduce((total, item) => total + item.durationMs, 0);
  const note = (text: string) => void (log = (log + text).slice(-ENCODER_LOG_LIMIT));

  async function prepare() {
    await rm(outDir, { recursive: true, force: true });
    for (const name of renditionNames(channel)) await mkdir(path.join(outDir, name), { recursive: true });
  }

  function launch(ready: EncoderInputs) {
    state = "starting";
    startedAt = now();
    const args = buildEncoderArgs(channel, ready, generation * SEGMENT_NUMBER_STRIDE);
    const proc = spawn(ffmpegPath, args, { cwd: outDir, stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
    child = proc;
    exited = new Promise((resolve) => {
      let done = false;
      const finish = (code: number) => {
        if (done) return;
        done = true;
        child = null;
        onExit(code);
        resolve();
      };
      proc.on("error", (error) => {
        note(`spawn error: ${error.message}\n`);
        finish(-1);
      });
      proc.on("exit", (code) => finish(code ?? -1));
    });
    proc.stderr?.on("data", (chunk: Buffer) => note(chunk.toString()));
  }

  function onExit(code: number) {
    if (stopping) {
      state = "stopped";
      return;
    }
    failures = now() - startedAt > ENCODER_STABLE_UPTIME_MS ? 1 : failures + 1;
    note(`ffmpeg exited with ${code}\n`);
    if (failures > ENCODER_MAX_FAST_FAILURES) {
      state = "failed";
      return;
    }
    state = "restarting";
    timer = setTimeout(async () => {
      timer = null;
      generation += 1;
      try {
        await prepare();
        if (!stopping && inputs) launch(inputs);
      } catch (error) {
        note(`restart failed: ${error instanceof Error ? error.message : String(error)}\n`);
        state = "failed";
      }
    }, Math.min(500 * 2 ** (failures - 1), 8_000));
  }

  return {
    mode: "encode",
    renditions: () => renditionNames(channel),
    playlist: () => items.map(({ name, durationMs }) => ({ name, durationMs })),
    /** The video ffmpeg is reading now: a run restarts the list, and -re reads at the videos' own pace. */
    nowPlaying() {
      if ((state !== "live" && state !== "starting") || cycleMs <= 0) return null;
      let at = (now() - startedAt) % cycleMs;
      const index = items.findIndex((item) => (at -= item.durationMs) < 0);
      const item = items[index];
      return item ? { index, name: item.name } : null;
    },
    state() {
      if (state === "starting" && existsSync(path.join(outDir, "master.m3u8"))) state = "live";
      return state;
    },
    async start() {
      stopping = false;
      failures = 0;
      generation = 0;
      inputs = await writeEncoderInputs(channel, items, inputsDir);
      await prepare();
      launch(inputs);
    },
    /** Reads a file the encoder wrote: [name] or [rendition, name]; null when absent or unsafe. */
    async read(parts) {
      if (parts.length < 1 || parts.length > 2 || !parts.every((part) => SAFE_PART.test(part))) return null;
      try {
        return await readFile(path.join(outDir, ...parts));
      } catch {
        return null;
      }
    },
    async stop() {
      stopping = true;
      if (timer !== null) clearTimeout(timer);
      timer = null;
      if (isRunning(child)) {
        await killProcessTree(child);
        let giveUp: NodeJS.Timeout | undefined;
        await Promise.race([exited, new Promise((resolve) => (giveUp = setTimeout(resolve, ENCODER_STOP_WAIT_MS)))]);
        clearTimeout(giveUp);
      }
      state = "stopped";
      await rm(outDir, { recursive: true, force: true });
      await rm(inputsDir, { recursive: true, force: true });
    },
  };
}
