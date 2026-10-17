/** For the opt-in live engine tests (`LIVE_ENGINE_TESTS=1`): real fixture videos, ffprobe and ffmpeg. */
import { mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";

import { locateTool } from "../../shared/media/dist/ffmpeg/locate-tool.js";
import { runTool } from "../../shared/media/dist/ffmpeg/run-tool.js";
import { type MakeAppOptions, makeApp, pick } from "./test-app.js";

export const ENGINE_TESTS = process.env.LIVE_ENGINE_TESTS === "1";
export const SKIP_REASON = "set LIVE_ENGINE_TESTS=1 to run the tests that need ffmpeg (and Chrome, for the browser ones)";

/**
 * Loop mode's encodes, shared by every test run on this machine: the first run encodes the fixture videos (a
 * minute or two), later runs reuse them. Never the owner's data folders.
 */
export const TEST_CACHE_DIR = path.join(os.tmpdir(), "giga-stream-live-test-cache");

const Fixtures = z.object({ dir: z.string() });

/** The fixture files (docs/10 section 2.1), made once per machine by `scripts/fixtures/make-fixtures.mjs`. */
export async function fixtures(): Promise<string> {
  // A variable specifier: the script is plain JavaScript, so it is loaded and its answer narrowed.
  const specifier = new URL("../../../scripts/fixtures/make-fixtures.mjs", import.meta.url).href;
  const script: unknown = await import(specifier);
  const ensure = pick(script, "ensureFixtures");
  if (typeof ensure !== "function") throw new Error("make-fixtures.mjs has no ensureFixtures");
  return Fixtures.parse(await ensure()).dir;
}

/** The path of one fixture video: `fixture(dir, "news", 1)`. */
export const fixture = (dir: string, kind: string, n: number) => path.join(dir, "live", `${kind}-${n}.mp4`);

/** An app with the real engine: the fixtures as FIXTURE_DIR and the shared encode cache. */
export async function realApp(options: MakeAppOptions = {}) {
  return makeApp({
    ...options,
    engine: "real",
    config: { FIXTURE_DIR: await fixtures(), CACHE_DIR: TEST_CACHE_DIR, ...options.config },
  });
}

/** ffprobe's video stream of bytes the server served. */
export async function probeVideo(bytes: Buffer): Promise<unknown> {
  const dir = mkdtempSync(path.join(os.tmpdir(), "giga-live-segment-"));
  try {
    writeFileSync(path.join(dir, "segment.ts"), bytes);
    const args = ["-v", "error", "-show_streams", "-of", "json", path.join(dir, "segment.ts")];
    const { stdout } = await runTool(locateTool("ffprobe"), args, { captureStdout: true });
    const streams = pick(JSON.parse(stdout), "streams");
    return Array.isArray(streams) ? streams.find((stream) => pick(stream, "codec_type") === "video") : undefined;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Every file below a folder (none when it does not exist). */
export function filesUnder(folder: string): string[] {
  try {
    return readdirSync(folder).flatMap((name) => {
      const full = path.join(folder, name);
      return statSync(full).isDirectory() ? filesUnder(full) : [full];
    });
  } catch {
    return [];
  }
}
