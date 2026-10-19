import test, { before } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { ensureFixtures } from "../../../../scripts/fixtures/make-fixtures.mjs";
import { TOOLS_BIN_DIR } from "../src/constants/media.ts";
import { locateTool, REPO_ROOT } from "../src/ffmpeg/locate-tool.ts";
import { runTool, ToolError } from "../src/ffmpeg/run-tool.ts";
import { factsFromProbe } from "../src/probe/facts-from-probe.ts";
import { probeFile } from "../src/probe/probe-file.ts";

let fixtures = "";
before(async () => {
  fixtures = (await ensureFixtures()).dir;
});

test("the bundled tools are found in the repository; the override folder wins; a missing one names where it looked", () => {
  for (const tool of ["ffmpeg", "ffprobe"] as const) {
    assert.ok(locateTool(tool).startsWith(path.join(REPO_ROOT, ...TOOLS_BIN_DIR)), tool);
  }
  const elsewhere = path.resolve("X:/ff");
  assert.equal(
    locateTool("ffprobe", { env: { GIGA_STREAM_FFMPEG_DIR: elsewhere }, exists: (f) => f.startsWith(elsewhere) }),
    path.join(elsewhere, process.platform === "win32" ? "ffprobe.exe" : "ffprobe"),
  );
  assert.throws(() => locateTool("ffmpeg", { root: "Z:/nowhere", env: {}, exists: () => false }), /ffmpeg not found; tried/);
});

test("probing a real fixture file gives its codecs, size, rate, channels and length", async () => {
  const facts = await probeFile(path.join(fixtures, "live", "sports-1.mp4"));
  assert.equal(facts.playable, true);
  assert.match(facts.container ?? "", /mp4/);
  assert.deepEqual([facts.videoCodec, facts.audioCodec, facts.width, facts.height, facts.frameRate, facts.audioChannels],
    ["h264", "aac", 1920, 1080, 30, 2]);
  assert.ok(Math.abs((facts.durationMs ?? 0) - 40_000) <= 100);
});

test("probing a file that does not exist or is not video says it cannot be read", async () => {
  assert.deepEqual(await probeFile(path.join(fixtures, "live", "missing.mp4")), {
    playable: false,
    problem: "The file could not be read as video.",
  });
});

test("ffprobe's answer for a stream with no video, or no length, is unplayable with the reason", () => {
  assert.equal(factsFromProbe({ format: { duration: "3" }, streams: [{ codec_type: "audio" }] }).problem, "The file has no video stream.");
  assert.equal(factsFromProbe({ streams: [{ codec_type: "video" }] }).problem, "The file has no length.");
});

test("a failing tool rejects with its exit code and stderr; aborting kills it", async () => {
  const ffmpeg = locateTool("ffmpeg");
  await assert.rejects(runTool(ffmpeg, ["-hide_banner", "-i", "no-such-input.mp4"]), (error: unknown) =>
    error instanceof ToolError && error.exitCode !== 0 && /no-such-input/.test(error.stderr));
  const abort = new AbortController();
  const running = runTool(ffmpeg, ["-hide_banner", "-re", "-i", path.join(fixtures, "live", "news-1.mp4"), "-f", "null", "-"], {
    signal: abort.signal,
  });
  setTimeout(() => abort.abort(new Error("stopped")), 300);
  await assert.rejects(running, /stopped/);
});
