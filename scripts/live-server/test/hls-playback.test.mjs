// Opt-in: LIVE_SERVER_BROWSER=1 node --test scripts/live-server/test/hls-playback.test.mjs
// Plays a loop-mode channel in muted headless Chrome with hls.js 1.5.20 (docs/10 section 5). It needs
// Chrome (CHROME_PATH or a default install), the repository's `ws` dependency and network access to
// the hls.js CDN.
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { startLiveServer } from "../live-server.mjs";
import { openChrome, waitFor } from "./chrome-session.mjs";

const enabled = process.env.LIVE_SERVER_BROWSER === "1";
const SEGMENT_MS = 2000;

async function withPlayer(run) {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "live-server-out-"));
  const live = await startLiveServer({ mode: "loop", port: 0, outDir, testPage: true });
  const chrome = await openChrome();
  const snapshot = () => chrome.evaluate("window.snapshot ? window.snapshot() : null");
  const control = (channel, action, body = {}) =>
    fetch(`${live.url}/control/${channel}/${action}`, { method: "POST", body: JSON.stringify(body) });
  const play = async (channel) => {
    await chrome.navigate(`${live.url}/test/player.html?channel=${channel}`);
    await waitFor(async () => (await snapshot())?.state === "playing", { timeoutMs: 15000, label: `${channel} playing` });
  };
  try {
    await run({ live, chrome, snapshot, control, play });
  } finally {
    await chrome.close();
    await live.stop();
    await rm(outDir, { recursive: true, force: true });
  }
}

/** After a fault is cleared the same page recovers without a reload (the page never navigates). */
async function recovers({ chrome, snapshot, control }, channel) {
  await control(channel, "clear");
  await chrome.evaluate("window.retry()");
  const before = (await snapshot()).currentTime;
  await waitFor(async () => {
    const now = await snapshot();
    return now.state === "playing" && now.currentTime > before + 2;
  }, { timeoutMs: 60000, label: `${channel} recovered` });
}

test("master lists two video levels, the audio group and captions on fx-news", { skip: !enabled }, async () => {
  await withPlayer(async ({ live }) => {
    const news = await (await fetch(`${live.url}/live/fx-news/master.m3u8`)).text();
    assert.ok((news.match(/RESOLUTION=/g) ?? []).length >= 2);
    assert.match(news, /TYPE=AUDIO,GROUP-ID="[^"]*aud[^"]*"/); // ffmpeg names the group, e.g. group_aud
    assert.match(news, /TYPE=SUBTITLES/);
    const sports = await (await fetch(`${live.url}/live/fx-sports/master.m3u8`)).text();
    assert.equal((sports.match(/RESOLUTION=/g) ?? []).length, 3);
  });
});

test("a live channel plays in real time with audio, ABR and a bounded latency", { skip: !enabled, timeout: 120000 }, async () => {
  await withPlayer(async ({ chrome, snapshot, play }) => {
    const opened = Date.now();
    await play("fx-news");
    assert.ok(Date.now() - opened < 5000 + 10000, "playback starts within 5 s of the page loading (plus load)");
    const first = await snapshot();
    assert.ok(first.levels.length >= 2, `levels ${first.levelNames}`);
    assert.ok(first.audioTracks >= 1, `audio tracks ${first.audioTracks}`);
    assert.ok(first.subtitleTracks >= 1, `subtitle tracks ${first.subtitleTracks}`);
    const wallStart = Date.now();
    const mediaStart = first.currentTime;
    await waitFor(async () => (await snapshot()).currentTime >= mediaStart + 20, { timeoutMs: 40000, label: "20 s of media" });
    const wall = (Date.now() - wallStart) / 1000;
    const media = (await snapshot()).currentTime - mediaStart;
    assert.ok(Math.abs(wall - media) / wall <= 0.1, `media ${media} s over ${wall} s of wall time`);
    const now = await snapshot();
    assert.ok(now.latency <= 4 * (SEGMENT_MS / 1000), `latency ${now.latency}`);
    assert.ok(now.audioBytes > 0 && now.frames > 0);
    await waitFor(async () => (await snapshot()).audioBytes > now.audioBytes, { label: "audio decode growing" });
    await waitFor(async () => (await snapshot()).topLevelSeen === now.levels.length - 1, { label: "ABR top level" });
    assert.equal(await chrome.evaluate("window.liveStats.errors.filter((e) => e.fatal).length"), 0);
  });
});

test("faults produce buffering or failed and clear recovers the same page", { skip: !enabled, timeout: 600000 }, async () => {
  await withPlayer(async (session) => {
    const { snapshot, control, play } = session;
    await play("fx-sports");
    const states = (...names) => async () => names.includes((await snapshot()).state);
    const slow = { timeoutMs: 90000 };

    await control("fx-sports", "fault", { fault: "stall" });
    await waitFor(states("buffering", "failed"), { ...slow, label: "stall buffering" });
    await recovers(session, "fx-sports");

    await control("fx-sports", "fault", { fault: "slow-segments", delayMs: 8000 });
    await waitFor(states("buffering", "failed"), { ...slow, label: "slow segments buffering" });
    await recovers(session, "fx-sports");

    await control("fx-sports", "fault", { fault: "playlist-500" });
    await waitFor(states("failed"), { ...slow, label: "playlist 500 failed" });
    await recovers(session, "fx-sports");

    await control("fx-sports", "fault", { fault: "segment-404" });
    await waitFor(states("failed"), { ...slow, label: "segment 404 failed" });
    await recovers(session, "fx-sports");

    await control("fx-sports", "fault", { fault: "end" });
    await waitFor(async () => (await snapshot()).ended || (await snapshot()).state !== "playing", { ...slow, label: "stream end" });
    await recovers(session, "fx-sports");

    for (const fault of ["discontinuity", "restart"]) {
      await control("fx-sports", "fault", { fault, durationMs: 8000 });
      await recovers(session, "fx-sports");
    }
  });
});

test("stopping the server closes the port", { skip: !enabled }, async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "live-server-out-"));
  const live = await startLiveServer({ mode: "loop", port: 0, outDir });
  assert.equal((await fetch(`${live.url}/healthz`)).status, 200);
  await live.stop();
  await assert.rejects(fetch(`${live.url}/healthz`));
  await rm(outDir, { recursive: true, force: true });
});
