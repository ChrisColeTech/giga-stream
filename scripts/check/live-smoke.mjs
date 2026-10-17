#!/usr/bin/env node
// The live smoke check: against an already RUNNING development stack, every enabled channel the Live page
// would show must really play. It exists because a stale row (a stream address on a retired port) passed the
// whole gate while the product showed "This stream will not play".
// Usage: node scripts/check/live-smoke.mjs [--optional]
// Env:   GIGA_SMOKE_BACKEND  the admin backend's origin (default http://127.0.0.1:3001)
//
// Checks, one line per failure: (1) the backend's public channel list answers; (2) each enabled `live` channel
// answers its master playlist (200, #EXTM3U) and the first variant or segment URI in it answers 200 too;
// (3) each enabled `stream` channel on a loopback address is probed and reported UNREACHABLE when nothing
// answers. Without a stack: exit 1, or with --optional print SKIPPED and exit 0. No sleeps, no polling.
const optional = process.argv.includes("--optional");
const backend = (process.env.GIGA_SMOKE_BACKEND ?? "http://127.0.0.1:3001").replace(/\/+$/, "");
const TIMEOUT_MS = 4000;
const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]"]);

const get = (url) => fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
const failures = [];
const fail = (channel, message) => failures.push(`live-smoke: FAIL ${channel.id} (${channel.name}): ${message}`);

/** The channels, or undefined when no backend answers at all. */
async function listChannels() {
  let response;
  try {
    response = await get(`${backend}/api/channels`);
  } catch {
    return undefined;
  }
  const body = await response.json().catch(() => undefined);
  if (!response.ok || body?.ok !== true || !Array.isArray(body.data?.items)) {
    console.error(`live-smoke: FAIL ${backend}/api/channels answered ${response.status} without the standard envelope`);
    process.exit(1);
  }
  return body.data.items;
}

/** A live channel plays: its playlist answers, and the first URI inside it answers as well. */
async function checkLive(channel) {
  // The list builds the address from the caller's origin; the path is what this backend serves.
  const playlistUrl = new URL(new URL(channel.streamUrl).pathname, `${backend}/`);
  let playlist;
  try {
    playlist = await get(playlistUrl);
  } catch (error) {
    return fail(channel, `playlist ${playlistUrl} did not answer (${error.name})`);
  }
  if (playlist.status !== 200) return fail(channel, `playlist ${playlistUrl} answered ${playlist.status}`);
  const text = await playlist.text();
  if (!text.startsWith("#EXTM3U")) return fail(channel, `playlist ${playlistUrl} is not an #EXTM3U body`);
  const first = text.split(/\r?\n/).find((line) => line.trim() !== "" && !line.startsWith("#"));
  if (first === undefined) return fail(channel, `playlist ${playlistUrl} lists no variant or segment`);
  const next = new URL(first.trim(), playlistUrl);
  try {
    const answer = await get(next);
    if (answer.status !== 200) fail(channel, `${next} answered ${answer.status}`);
    await answer.body?.cancel();
  } catch (error) {
    fail(channel, `${next} did not answer (${error.name})`);
  }
}

/** A stream channel on this computer's own address must have something listening: the stale-row failure. */
async function checkLoopbackStream(channel) {
  if (!URL.canParse(channel.streamUrl) || !LOOPBACK.has(new URL(channel.streamUrl).hostname)) return;
  try {
    const answer = await get(channel.streamUrl);
    await answer.body?.cancel();
  } catch {
    fail(channel, `UNREACHABLE ${channel.streamUrl} (nothing answers; a stale row from a retired server?)`);
  }
}

const channels = await listChannels();
if (channels === undefined) {
  if (optional) {
    console.log(`live-smoke: SKIPPED (no stack at ${backend})`);
    process.exit(0);
  }
  console.error(`live-smoke: FAIL no stack at ${backend} (start npm run dev, or set GIGA_SMOKE_BACKEND)`);
  process.exit(1);
}

for (const channel of channels) {
  if (channel.kind === "live") await checkLive(channel);
  else if (channel.kind === "stream") await checkLoopbackStream(channel);
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`live-smoke: PASS (${channels.length} channels at ${backend})`);
