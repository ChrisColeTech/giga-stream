import { spawn as nodeSpawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";

import { buildEncoderArgs, renditionNames } from "./encoder-args.mjs";
import { killProcessTree, isRunning } from "./process-tree.mjs";

const SAFE_PART = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const LOG_LIMIT = 16 * 1024;
const STABLE_UPTIME_MS = 10_000;
const MAX_FAST_FAILURES = 5;
const STOP_WAIT_MS = 5_000;
const SEGMENT_NUMBER_STRIDE = 100_000;

/**
 * Encode mode: supervises one real-time ffmpeg that loops the channel's fixture file into a live HLS
 * window in `<outDir>/<channelId>/`. States: starting | live | restarting | stopped | failed. An
 * unexpected exit restarts with exponential backoff; five quick failures in a row end in `failed`.
 */
export function createEncoderChannel({
  channel,
  fixture,
  outDir,
  ffmpegPath,
  spawn = nodeSpawn,
  kill = killProcessTree,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  now = Date.now,
}) {
  const dir = path.join(outDir, channel.id);
  let state = "stopped";
  let child = null;
  let timer = null;
  let stopping = false;
  let failures = 0;
  let generation = 0;
  let startedAt = 0;
  let log = "";
  let exited = Promise.resolve();

  const note = (text) => {
    log = (log + text).slice(-LOG_LIMIT);
  };

  async function prepare() {
    await rm(dir, { recursive: true, force: true });
    for (const name of renditionNames(channel)) await mkdir(path.join(dir, name), { recursive: true });
  }

  function launch() {
    const args = buildEncoderArgs(channel, fixture, { startNumber: generation * SEGMENT_NUMBER_STRIDE });
    state = "starting";
    startedAt = now();
    const proc = spawn(ffmpegPath, args, { cwd: dir, stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
    child = proc;
    exited = new Promise((resolve) => {
      let done = false;
      const finish = (code) => {
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
    proc.stderr?.on("data", (chunk) => note(chunk.toString()));
  }

  function onExit(code) {
    if (stopping) {
      state = "stopped";
      return;
    }
    failures = now() - startedAt > STABLE_UPTIME_MS ? 1 : failures + 1;
    note(`ffmpeg exited with ${code}\n`);
    if (failures > MAX_FAST_FAILURES) {
      state = "failed";
      return;
    }
    state = "restarting";
    const delay = Math.min(500 * 2 ** (failures - 1), 8_000);
    timer = setTimer(async () => {
      timer = null;
      generation += 1;
      try {
        await prepare();
        if (!stopping) launch();
      } catch (error) {
        note(`restart failed: ${error.message}\n`);
        state = "failed";
      }
    }, delay);
  }

  return {
    id: channel.id,
    mode: "encode",
    renditions: () => renditionNames(channel),
    logTail: () => log,
    state() {
      if (state === "starting" && existsSync(path.join(dir, "master.m3u8"))) state = "live";
      return state;
    },
    async start() {
      stopping = false;
      failures = 0;
      generation = 0;
      await prepare();
      launch();
    },
    /** Reads a file the encoder wrote: [name] or [rendition, name]; null when absent or unsafe. */
    async read(parts) {
      if (parts.length < 1 || parts.length > 2 || !parts.every((part) => SAFE_PART.test(part))) return null;
      try {
        return await readFile(path.join(dir, ...parts));
      } catch {
        return null;
      }
    },
    async stop() {
      stopping = true;
      if (timer !== null) clearTimer(timer);
      timer = null;
      if (isRunning(child)) {
        await kill(child);
        let giveUp = null;
        const limit = new Promise((resolve) => {
          giveUp = setTimer(resolve, STOP_WAIT_MS);
        });
        await Promise.race([exited, limit]);
        clearTimer(giveUp);
      }
      state = "stopped";
      await rm(dir, { recursive: true, force: true });
    },
  };
}
