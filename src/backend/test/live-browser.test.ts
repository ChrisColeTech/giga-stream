// Opt-in (LIVE_ENGINE_TESTS=1): plays the seeded channels in muted headless Chrome with hls.js 1.5.20 from the
// merged backend (docs/10 section 5). It needs Chrome (CHROME_PATH or a default install), ffmpeg and the hls.js CDN.
import assert from "node:assert/strict";
import test from "node:test";

import { itemOf } from "./live-channel-kit.js";
import { type ChromeSession, openChrome, waitFor } from "./live-chrome-session.js";
import { ENGINE_TESTS, realApp, SKIP_REASON } from "./live-engine-kit.js";
import { pick, send, signIn } from "./test-app.js";

const skip = ENGINE_TESTS ? false : SKIP_REASON;
const SEGMENT_SECONDS = 2;

interface Session {
  token: string;
  chrome: ChromeSession;
  nowPlaying(id: string): Promise<unknown>;
  snapshot(): Promise<unknown>;
  play(channel: string): Promise<void>;
  fault(channel: string, body: unknown): Promise<unknown>;
}

const num = (value: unknown, dotted: string) => Number(pick(value, dotted));

/** The real clock (a player runs in real time), optionally moved on by `shift`. */
async function withPlayer(run: (session: Session) => Promise<void>, now?: () => number) {
  const t = await realApp({ seed: true, now: now ?? Date.now, config: { TEST_PAGE: true } });
  await t.live.settled();
  const token = (await signIn(t.app)).access;
  const url = await t.app.listen({ port: 0, host: "127.0.0.1" });
  const chrome = await openChrome();
  const snapshot = () => chrome.evaluate("window.snapshot ? window.snapshot() : null");
  const session: Session = {
    token,
    chrome,
    snapshot,
    async nowPlaying(id) {
      return itemOf((await send(t.app, "GET", "/api/admin-channels", undefined, token)).body, id).nowPlaying;
    },
    async play(channel) {
      await chrome.navigate(`${url}/test/player.html?channel=${channel}`);
      await waitFor(async () => pick(await snapshot(), "state") === "playing", { timeoutMs: 15000, label: `${channel} playing` });
    },
    fault: (channel, body) =>
      body === null
        ? send(t.app, "DELETE", `/api/channels/${channel}/fault`, undefined, token)
        : send(t.app, "PUT", `/api/channels/${channel}/fault`, body, token),
  };
  try {
    await run(session);
  } finally {
    await chrome.close();
  }
}

/** After a fault is cleared the same page recovers without a reload. */
async function recovers({ chrome, snapshot, fault }: Session, channel: string) {
  await fault(channel, null);
  await chrome.evaluate("window.retry()");
  const before = num(await snapshot(), "currentTime");
  await waitFor(async () => {
    const now = await snapshot();
    return pick(now, "state") === "playing" && num(now, "currentTime") > before + 2;
  }, { timeoutMs: 60000, label: `${channel} recovered` });
}

test("a live channel plays in real time with audio, captions, ABR and a bounded latency", { skip, timeout: 120000 }, async () => {
  await withPlayer(async ({ chrome, snapshot, play }) => {
    await play("fx-news");
    const first = await snapshot();
    assert.ok(num(first, "levels.length") >= 2);
    assert.ok(num(first, "audioTracks") >= 1 && num(first, "subtitleTracks") >= 1);
    const wallStart = Date.now();
    const mediaStart = num(first, "currentTime");
    await waitFor(async () => num(await snapshot(), "currentTime") >= mediaStart + 20, { timeoutMs: 40000, label: "20 s of media" });
    const wall = (Date.now() - wallStart) / 1000;
    const now = await snapshot();
    const media = num(now, "currentTime") - mediaStart;
    assert.ok(Math.abs(wall - media) / wall <= 0.1, `media ${media} s over ${wall} s of wall time`);
    assert.ok(num(now, "latency") <= 4 * SEGMENT_SECONDS, `latency ${num(now, "latency")}`);
    await waitFor(async () => num(await snapshot(), "audioBytes") > num(now, "audioBytes"), { label: "audio decode growing" });
    await waitFor(async () => num(await snapshot(), "topLevelSeen") === num(now, "levels.length") - 1, { label: "ABR top level" });
    assert.equal(await chrome.evaluate("window.liveStats.errors.filter((e) => e.fatal).length"), 0);
  });
});

test("playback runs on across the switch to the playlist's next video", { skip, timeout: 120000 }, async () => {
  // Once started, jump the channels 12 s ahead (24 s in): news-1 (15 segments) switches to news-2 at number
  // 15, a few seconds ahead of where the player joins.
  const shift = { ms: 0 };
  await withPlayer(async ({ chrome, snapshot, play, nowPlaying }) => {
    shift.ms = 12_000;
    assert.deepEqual(pick(await nowPlaying("fx-news"), "name"), "news-1.mp4");
    await play("fx-news");
    const mediaStart = num(await snapshot(), "currentTime");
    await waitFor(async () => pick(await nowPlaying("fx-news"), "name") === "news-2.mp4", { timeoutMs: 30000, label: "switch to news-2" });
    await waitFor(async () => num(await snapshot(), "currentTime") >= mediaStart + 16, { timeoutMs: 40000, label: "16 s of media" });
    const after = await snapshot();
    assert.equal(pick(after, "state"), "playing");
    await waitFor(async () => num(await snapshot(), "frames") > num(after, "frames"), { label: "frames after the switch" });
    assert.equal(await chrome.evaluate("window.liveStats.errors.filter((e) => e.fatal).length"), 0);
  }, () => Date.now() + shift.ms);
});

test("faults produce buffering or failed and clearing recovers the same page", { skip, timeout: 600000 }, async () => {
  await withPlayer(async (session) => {
    const { snapshot, fault, play } = session;
    await play("fx-sports");
    const states = (...names: string[]) => async () => names.includes(String(pick(await snapshot(), "state")));
    const slow = { timeoutMs: 90000 };
    for (const [body, wanted] of [
      [{ fault: "stall" }, ["buffering", "failed"]],
      [{ fault: "slow-segments", delayMs: 8000 }, ["buffering", "failed"]],
      [{ fault: "playlist-500" }, ["failed"]],
      [{ fault: "segment-404" }, ["failed"]],
    ] as const) {
      await fault("fx-sports", body);
      await waitFor(states(...wanted), { ...slow, label: `${body.fault} -> ${wanted.join(" or ")}` });
      await recovers(session, "fx-sports");
    }
    await fault("fx-sports", { fault: "end" });
    await waitFor(async () => pick(await snapshot(), "ended") === true || pick(await snapshot(), "state") !== "playing", slow);
    await recovers(session, "fx-sports");
    for (const name of ["discontinuity", "restart"]) {
      await fault("fx-sports", { fault: name, durationMs: 8000 });
      await recovers(session, "fx-sports");
    }
  });
});
