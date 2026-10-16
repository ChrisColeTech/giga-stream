#!/usr/bin/env node
// The development and test live stream server (docs/10). Never imported by src/ programs.
// Usage: node scripts/live-server/live-server.mjs [--mode encode|loop] [--port 8097] [--out dir]
//        [--channel fx-news]... [--test-page]
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { locateTool, REPO_ROOT } from "../../src/shared/media/src/ffmpeg/locate-tool.ts";
import { loadCatalog, MODES, selectChannels } from "./channel-catalog.mjs";
import { loadChannelFixtures } from "./channel-fixtures.mjs";
import { createEncoderChannel } from "./encoder-channel.mjs";
import { createFaultState } from "./fault-state.mjs";
import { createHttpServer } from "./http-server.mjs";
import { createLoopChannel } from "./loop-channel.mjs";
import { ensureLoopSource, loadLoopSource } from "./loop-source.mjs";
import { playerPage } from "./test-page.mjs";

export const DEFAULT_OUT_DIR = path.join(REPO_ROOT, ".live-server");
export const DEFAULT_CLI_PORT = 8097;

async function makeLoopBackend(channel, fixture, { outDir, ffmpegPath, clock }) {
  const cacheDir = path.join(outDir, ".cache", channel.id);
  await ensureLoopSource({ channel, fixture, cacheDir, ffmpegPath });
  return createLoopChannel({ channel, source: await loadLoopSource(cacheDir), clock });
}

/**
 * Starts the server and its channels and resolves once it is listening.
 * `mode` forces every channel's mode (otherwise each channel's own default); `port` 0 picks a free
 * port; `channels` is a list of ids (empty for all); `testPage` adds /test/player.html.
 * Returns { url, port, pid, mode, channels, outDir, faults, stop() }; stop() is idempotent.
 */
export async function startLiveServer(options = {}) {
  const { mode, port = 0, host = "127.0.0.1", outDir = DEFAULT_OUT_DIR, testPage = false } = options;
  const { channels: ids = [], clock = Date.now, ffmpegPath = locateTool("ffmpeg"), fixtureRoot, log } = options;
  if (mode !== undefined && !MODES.includes(mode)) throw new Error(`live-server: mode must be ${MODES.join(" or ")}`);
  const selected = selectChannels(loadCatalog(), ids);
  await mkdir(outDir, { recursive: true });
  // Every channel streams a real file: find and load them all, through the shared scanner, before any starts.
  const fixtures = await loadChannelFixtures(selected, { root: fixtureRoot, log });

  const faults = createFaultState({ now: clock });
  const entries = new Map();
  const stopAll = () => Promise.all([...entries.values()].map(({ backend }) => backend.stop()));
  try {
    // Built in parallel, listed in catalog order (not in the order the encodes happen to finish).
    const backends = await Promise.all(
      selected.map(async (channel) => {
        const channelMode = mode ?? channel.mode;
        const fixture = fixtures.get(channel.id);
        return channelMode === "loop"
          ? makeLoopBackend(channel, fixture, { outDir, ffmpegPath, clock })
          : createEncoderChannel({ channel, fixture, outDir, ffmpegPath });
      }),
    );
    selected.forEach((channel, index) => entries.set(channel.id, { channel, backend: backends[index] }));
    for (const { backend } of entries.values()) await backend.start();
  } catch (error) {
    await stopAll();
    throw error;
  }

  const modes = new Set([...entries.values()].map(({ backend }) => backend.mode));
  const summaryMode = modes.size === 1 ? [...modes][0] : "mixed";
  const server = createHttpServer({
    mode: summaryMode,
    channels: entries,
    faults,
    testPage: testPage ? playerPage() : null,
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  const boundPort = server.address().port;
  let stopping = null;
  return {
    url: `http://${host}:${boundPort}`,
    port: boundPort,
    pid: process.pid,
    mode: summaryMode,
    channels: selected.map((channel) => channel.id),
    outDir,
    faults,
    stop() {
      stopping ??= (async () => {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
        await stopAll();
      })();
      return stopping;
    },
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      mode: { type: "string", default: "encode" },
      port: { type: "string", default: String(DEFAULT_CLI_PORT) },
      out: { type: "string", default: DEFAULT_OUT_DIR },
      channel: { type: "string", multiple: true, default: [] },
      "test-page": { type: "boolean", default: false },
    },
  });
  const live = await startLiveServer({
    mode: values.mode,
    port: Number(values.port),
    outDir: path.resolve(values.out),
    channels: values.channel,
    testPage: values["test-page"],
    log: (line) => process.stderr.write(`live-server: ${line}\n`),
  });
  const ready = { url: live.url, port: live.port, pid: live.pid, mode: live.mode, channels: live.channels };
  process.stdout.write(`LIVE_SERVER_READY ${JSON.stringify(ready)}\n`);

  let leaving = false;
  const leave = async () => {
    if (leaving) return;
    leaving = true;
    await live.stop();
    process.exit(0);
  };
  process.on("SIGINT", leave);
  process.on("SIGTERM", leave);
  if (!process.stdin.isTTY) {
    process.stdin.on("end", leave);
    process.stdin.on("close", leave);
    process.stdin.resume();
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`live-server: ${error.message}\n`);
    process.exit(1);
  });
}
