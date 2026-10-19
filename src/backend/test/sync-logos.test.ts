// Sync steps 3 and 4 (docs/43 section 3.4): missing logo addresses come from the iptv-org index; logo bytes are cached on
// disk under their content hash; the cache rechecks after 7 days, heals a missing file, refuses non-images and
// oversize bodies, keeps an old file on failure, and collects what no channel references.
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { LOGO_MAX_BYTES, LOGO_RECHECK_MS } from "../src/constants/limits.js";
import { pick } from "./test-app.js";
import { GIF, JPEG, LOGO, PNG, PNG_TWO, STREAM, SVG, WEBP, fakeNet, image, m3uEntry, setupSync, type Sync } from "./sync-kit.js";

const cacheOf = (s: Sync): string[] => {
  const dir = path.join(s.t.dataDir, "logo-cache");
  return existsSync(dir) ? readdirSync(dir).sort() : [];
};
const byName = async (s: Sync, name: string): Promise<Record<string, unknown>> =>
  (await s.channels()).find((c) => c.name === name) ?? {};

test("logos are cached under the content hash, once for identical bytes, with the extension the bytes choose", async () => {
  const net = fakeNet();
  net.set(LOGO("a"), image(PNG));
  net.set(LOGO("b"), image(PNG));
  net.set(LOGO("c"), image(JPEG, "image/jpeg"));
  net.set(LOGO("d"), image(GIF, "text/plain"));
  net.set(LOGO("e"), image(WEBP, "image/webp"));
  const s = await setupSync(net, ["a", "b", "c", "d", "e"].map((n) => m3uEntry(n, STREAM("s.example", n), LOGO(n))));
  const done = await s.run();
  assert.deepEqual([pick(done, "lastCounts.logosCached"), pick(done, "lastCounts.logosFailed")], [4, 1], "d is not image/*");
  const files = cacheOf(s);
  assert.equal(files.length, 3, "a and b are one file");
  assert.deepEqual(files.map((f) => f.split(".")[1]).sort(), ["jpg", "png", "webp"]);
  assert.ok(files.every((f) => /^[0-9a-f]{32}\.(png|jpg|webp)$/.test(f)));
  const a = await byName(s, "a");
  assert.equal(a.cachedLogoUrl, (await byName(s, "b")).cachedLogoUrl, "the same bytes, the same file");
  assert.equal(a.cachedLogoUrl, `/logos/c/${files.find((f) => f.endsWith(".png"))}`);
  assert.equal(a.logoUrl, LOGO("a"), "logoUrl stays the source address");
  assert.equal((await byName(s, "d")).cachedLogoUrl, undefined);
  const served = await s.t.app.inject({ method: "GET", url: String(a.cachedLogoUrl) });
  assert.deepEqual([served.statusCode, served.rawPayload.equals(PNG)], [200, true]);
});

test("a body that is not PNG, JPEG, GIF or WebP, or is over 1 MiB, or is not 2xx, is refused and cached as nothing", async () => {
  const net = fakeNet();
  net.set(LOGO("svg"), image(SVG, "image/svg+xml"));
  net.set(LOGO("lie"), image(Buffer.from("<html>not an image</html>")));
  net.set(LOGO("big"), image(Buffer.concat([PNG, Buffer.alloc(LOGO_MAX_BYTES)])));
  net.set(LOGO("gone"), { status: 404, headers: { "content-type": "image/png" }, body: PNG });
  net.set(LOGO("slow"), { fail: "safe_fetch.timeout" });
  const s = await setupSync(net, ["svg", "lie", "big", "gone", "slow"].map((n) => m3uEntry(n, STREAM("s.example", n), LOGO(n))));
  const done = await s.run();
  assert.deepEqual([pick(done, "lastCounts.logosCached"), pick(done, "lastCounts.logosFailed")], [0, 5]);
  assert.deepEqual(cacheOf(s), []);
  assert.ok((await s.channels()).every((c) => c.cachedLogoUrl === undefined));
});

test("a logo is fetched again after 7 days, not before; a missing file is fetched again at once", async () => {
  const net = fakeNet();
  net.set(LOGO("a"), image(PNG));
  net.set(LOGO("bad"), image(Buffer.from("nope")));
  const s = await setupSync(net, [m3uEntry("a", STREAM("s.example", "a"), LOGO("a")), m3uEntry("bad", STREAM("s.example", "bad"), LOGO("bad"))]);
  await s.run();
  assert.equal(net.asked("https://img.example/").length, 2);
  await s.run(60_000);
  assert.equal(net.asked("https://img.example/").length, 2, "inside 7 days neither the cached nor the failed address is fetched");

  unlinkSync(path.join(s.t.dataDir, "logo-cache", cacheOf(s)[0] ?? ""));
  const healed = await s.run(60_000);
  assert.equal(net.asked(LOGO("a")).length, 2, "the missing file is fetched again, whatever its check time");
  assert.equal(net.asked(LOGO("bad")).length, 1);
  assert.equal(pick(healed, "lastCounts.logosCached"), 1);
  assert.equal(cacheOf(s).length, 1);

  await s.run(LOGO_RECHECK_MS + 1);
  assert.deepEqual([net.asked(LOGO("a")).length, net.asked(LOGO("bad")).length], [3, 2], "past 7 days both are checked again");
  assert.equal(cacheOf(s).length, 1, "the same bytes are not written twice");
});

test("a failed re-download keeps the old file and the cached address; it only moves the check time", async () => {
  const net = fakeNet();
  net.set(LOGO("a"), image(PNG));
  const s = await setupSync(net, [m3uEntry("a", STREAM("s.example", "a"), LOGO("a"))]);
  await s.run();
  const before = cacheOf(s);
  const cached = (await byName(s, "a")).cachedLogoUrl;
  net.set(LOGO("a"), { fail: "safe_fetch.timeout" });
  const done = await s.run(LOGO_RECHECK_MS + 1);
  assert.deepEqual([pick(done, "lastCounts.logosCached"), pick(done, "lastCounts.logosFailed")], [0, 1]);
  assert.deepEqual([cacheOf(s), (await byName(s, "a")).cachedLogoUrl], [before, cached]);
  const asked = net.asked(LOGO("a")).length;
  await s.run(60_000);
  assert.equal(net.asked(LOGO("a")).length, asked, "the failure was stamped: no retry inside 7 days");
});

test("garbage collection deletes the files no channel references, and only at the end of a run", async () => {
  const net = fakeNet();
  net.set(LOGO("a"), image(PNG));
  net.set(LOGO("b"), image(PNG_TWO));
  const s = await setupSync(net, [m3uEntry("a", STREAM("s.example", "a"), LOGO("a")), m3uEntry("b", STREAM("s.example", "b"), LOGO("b"))]);
  await s.run();
  assert.equal(cacheOf(s).length, 2);
  const dir = path.join(s.t.dataDir, "logo-cache");
  const stray = `${"f".repeat(32)}.png`;
  writeFileSync(path.join(dir, stray), PNG);
  writeFileSync(path.join(dir, "notes.txt"), "not a cache name: left alone");
  const b = await byName(s, "b");
  await s.api("PATCH", `/api/admin/channels/${String(b.id)}`, { logoUrl: LOGO("a") });
  assert.equal(cacheOf(s).length, 4, "nothing is collected by an edit");
  await s.run();
  const left = cacheOf(s);
  assert.equal(left.includes(stray), false, "the stray file went");
  assert.deepEqual(left.filter((f) => f !== "notes.txt").length, 1, "b's old image is no longer referenced");
  assert.ok(left.includes("notes.txt"));
  assert.equal(readFileSync(path.join(dir, left.find((f) => f.endsWith(".png")) ?? "")).equals(PNG), true);
});

test("missing logo addresses are filled from the index by tvg id then name, one revision, own and edited addresses untouched", async () => {
  const net = fakeNet();
  net.set("https://iptv-org.github.io/api/logos.json", { body: JSON.stringify([
    { channel: "TQ.ca", url: "https://img.example/tq.png", in_use: true },
    { channel: "ABC.us", url: "https://img.example/abc.png" },
    { channel: "OWN.us", url: "https://img.example/own-index.png" },
    "junk",
  ]) });
  net.set("https://iptv-org.github.io/api/channels.json", { body: JSON.stringify([
    { id: "TQ.ca", name: "Télé-Québec" }, { id: "ABC.us", name: "Elsewhere" }, { id: "OWN.us", name: "Own" },
  ]) });
  net.set("https://img.example/tq.png", image(PNG));
  const s = await setupSync(net, [
    m3uEntry("Tele Quebec", STREAM("s.example", "tq")),
    `#EXTINF:-1 tvg-id="ABC.us@East" group-title="News",Whatever\n${STREAM("s.example", "abc")}`,
    m3uEntry("Own", STREAM("s.example", "own"), "https://img.example/own.png"),
    m3uEntry("Unknown", STREAM("s.example", "unknown")),
  ]);
  const unknown = await byName(s, "Unknown");
  await s.api("PATCH", `/api/admin/channels/${String(unknown.id)}`, { logoUrl: "https://img.example/mine.png" });
  const before = await s.revision();
  await s.run();
  const rows = Object.fromEntries((await s.channels()).map((c) => [String(c.name), c.logoUrl]));
  assert.deepEqual(rows, {
    "Tele Quebec": "https://img.example/tq.png",
    Whatever: "https://img.example/abc.png",
    Own: "https://img.example/own.png",
    Unknown: "https://img.example/mine.png",
  });
  assert.equal(await s.revision(), before + 1, "the filled addresses are one revision");
  assert.equal(net.asked("https://iptv-org.github.io/api/logos.json").length, 1, "the index loads once per run");
  assert.equal(net.asked("https://img.example/tq.png").length, 1, "and the filled address is cached in the same run");
  await s.run();
  assert.equal(await s.revision(), before + 1, "nothing left to fill: no revision");
});
