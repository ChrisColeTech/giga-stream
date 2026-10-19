// The iptv-org logo index (docs/43 section 3.4 step 3): a malformed row is skipped, a failed load is stamped on disk and
// retried after an hour (not once per entry), accents are folded, and every fetch goes through the guarded function.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { removeDir } from "./db-kit.js";
import test, { after } from "node:test";

import { LOGO_INDEX_RETRY_MS } from "../src/constants/limits.js";
import { createLogoResolver, normalizeChannelName } from "../src/services/logo-resolver.js";
import { fakeNet, type Net } from "./sync-kit.js";

const LOGOS = "https://iptv-org.github.io/api/logos.json";
const CHANNELS = "https://iptv-org.github.io/api/channels.json";
const dirs: string[] = [];
after(() => dirs.forEach((dir) => removeDir(dir)));

function resolverOn(net: Net, dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-logo-index-"))) {
  dirs.push(dataDir);
  const clock = { at: 1_000_000 };
  const make = () => createLogoResolver({ dataDir, ttlHours: 24, safeFetch: net.safeFetch, now: () => clock.at });
  return { dataDir, clock, make, signal: new AbortController().signal };
}

const json = (value: unknown) => ({ body: JSON.stringify(value) });

test("a malformed row is skipped, never thrown on, and the good rows still resolve", async () => {
  const net = fakeNet();
  net.set(LOGOS, json([
    5, null, "x", { channel: 7, url: "https://img.example/bad.png" },
    { channel: "ABC.us", url: "https://img.example/abc.png", in_use: true, width: 10, height: 10, format: "PNG" },
    { channel: "ABC.us", url: "https://img.example/abc-small.png", width: 1, height: 1 },
    { channel: "NOPE.us", url: "javascript:alert(1)" },
  ]));
  net.set(CHANNELS, json([{ id: 4 }, null, { id: "ABC.us", name: "ABC News HD", alt_names: ["Alphabet"] }, { id: "ABC.us", alt_names: 3 }]));
  const { make, signal } = resolverOn(net);
  const resolver = make();
  await resolver.load(signal);
  assert.equal(resolver.lookup("anything", "ABC.us@SD"), "https://img.example/abc.png", "by tvg id, the @feed suffix dropped");
  assert.equal(resolver.lookup("ABC News"), "https://img.example/abc.png", "by name, quality tags out");
  assert.equal(resolver.lookup("Alphabet"), "https://img.example/abc.png", "by alt name");
  assert.equal(resolver.lookup("Nope", "NOPE.us"), undefined, "an unaccepted address is not indexed");
});

test("accents are folded before they are stripped: Télé is tele", async () => {
  assert.equal(normalizeChannelName("Télé-Québec HD"), "telequebec");
  assert.equal(normalizeChannelName("Tele Quebec"), "telequebec");
  const net = fakeNet();
  net.set(LOGOS, json([{ channel: "TQ.ca", url: "https://img.example/tq.png" }]));
  net.set(CHANNELS, json([{ id: "TQ.ca", name: "Télé-Québec" }]));
  const { make, signal } = resolverOn(net);
  const resolver = make();
  await resolver.load(signal);
  assert.equal(resolver.lookup("Tele Quebec"), "https://img.example/tq.png");
  assert.equal(resolver.lookup("TÉLÉ QUÉBEC (CA)"), "https://img.example/tq.png");
});

test("a failed load persists a retry stamp: it is not tried again for an hour, by this run or after a restart", async () => {
  const net = fakeNet();
  const { make, clock, dataDir, signal } = resolverOn(net);
  const first = make();
  await first.load(signal);
  const attempts = net.log.length;
  assert.equal(attempts, 4, "both lists, each with its failover address, all through the guarded fetch");
  assert.equal(first.lookup("ABC"), undefined);
  await first.load(signal);
  await make().load(signal);
  assert.equal(net.log.length, attempts, "no entry, and no restart inside the hour, downloads the index again");
  assert.equal(typeof JSON.parse(readFileSync(path.join(dataDir, "logo-index.json"), "utf-8")).failedAt, "number");

  clock.at += LOGO_INDEX_RETRY_MS + 1;
  net.set(LOGOS, json([{ channel: "ABC.us", url: "https://img.example/abc.png" }]));
  net.set(CHANNELS, json([{ id: "ABC.us", name: "ABC" }]));
  const later = make();
  await later.load(signal);
  assert.equal(later.lookup("ABC"), "https://img.example/abc.png", "an hour on, it retries and succeeds");
});

test("a failed refresh keeps the stale index it had", async () => {
  const net = fakeNet();
  net.set(LOGOS, json([{ channel: "ABC.us", url: "https://img.example/abc.png" }]));
  net.set(CHANNELS, json([{ id: "ABC.us", name: "ABC" }]));
  const { make, clock, signal } = resolverOn(net);
  await make().load(signal);
  clock.at += 25 * 3_600_000;
  net.set(LOGOS, { fail: "safe_fetch.timeout" });
  net.set(CHANNELS, { status: 500 });
  const stale = make();
  await stale.load(signal);
  assert.equal(stale.lookup("ABC"), "https://img.example/abc.png");
});

test("a stop is not a failure: nothing is stamped", async () => {
  const net = fakeNet();
  const { make, dataDir } = resolverOn(net);
  const stopped = new AbortController();
  stopped.abort();
  const resolver = make();
  await resolver.load(stopped.signal);
  assert.throws(() => readFileSync(path.join(dataDir, "logo-index.json")), "no file written");
});
