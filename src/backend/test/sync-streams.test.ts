// Sync step 5 (docs/43 section 3.4; the words of docs/51): each channel's own exact stream address decides online or
// offline; no host shortcut; one verdict per distinct address; compare-and-set writes; no revision; the probe budget.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { PROBE_BUDGET_MS } from "../src/constants/limits.js";
import { createStore } from "../src/store/store.js";
import { pick, send } from "./test-app.js";
import { MANIFEST, STREAM, fakeNet, m3uEntry, setupSync, type Sync } from "./sync-kit.js";

const statusOf = async (s: Sync): Promise<Record<string, unknown>> =>
  Object.fromEntries((await s.channels()).map((c) => [String(c.name), c.status ?? "unchecked"]));

test("online iff 2xx and a manifest after a BOM and whitespace; anything else, on that address only, is offline", async () => {
  const net = fakeNet();
  const names = ["live", "bom", "html", "teapot", "timeout", "dns", "refused", "empty", "plain"];
  net.set(STREAM("s.example", "live"), MANIFEST);
  net.set(STREAM("s.example", "bom"), { body: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("\n  #EXTM3U\n")]) });
  net.set(STREAM("s.example", "html"), { body: "<html>#EXTM3U</html>" });
  net.set(STREAM("s.example", "teapot"), { status: 418, body: "#EXTM3U" });
  net.set(STREAM("s.example", "timeout"), { fail: "safe_fetch.timeout" });
  net.set(STREAM("s.example", "dns"), { fail: "safe_fetch.failed" });
  net.set(STREAM("s.example", "refused"), { fail: "safe_fetch.blocked_address" });
  net.set(STREAM("s.example", "empty"), { body: "" });
  net.set(STREAM("s.example", "plain"), { body: "GG@@ not hls" });
  const s = await setupSync(net, names.map((n) => m3uEntry(n, STREAM("s.example", n))));
  const done = await s.run();
  assert.deepEqual(await statusOf(s), {
    live: "online", bom: "online", html: "offline", teapot: "offline", timeout: "offline", dns: "offline", refused: "offline", empty: "offline", plain: "offline",
  });
  assert.deepEqual(["online", "offline", "unchecked"].map((f) => pick(done, `lastCounts.${f}`)), [2, 7, 0]);
  assert.ok((await s.channels()).every((c) => typeof c.checkedAt === "number"));
});

test("a host that fails for one address is not a verdict on the others: a DNS failure marks only that channel offline", async () => {
  const net = fakeNet();
  net.set(STREAM("same.example", "good"), MANIFEST);
  net.set(STREAM("same.example", "down"), { fail: "safe_fetch.failed" });
  net.set(STREAM("same.example", "also-good"), MANIFEST);
  const s = await setupSync(net, ["good", "down", "also-good"].map((n) => m3uEntry(n, STREAM("same.example", n))));
  await s.run();
  assert.deepEqual(await statusOf(s), { good: "online", down: "offline", "also-good": "online" });
  assert.equal(net.asked("https://same.example/").length, 3, "every address got its own request");
});

test("a distinct address is requested once and gives one verdict to every channel with it", async () => {
  const net = fakeNet();
  net.set(STREAM("s.example", "shared"), MANIFEST);
  const s = await setupSync(net, [m3uEntry("one", STREAM("s.example", "shared")), m3uEntry("two", STREAM("s.example", "shared")), m3uEntry("three", STREAM("s.example", "other"))]);
  await s.run();
  assert.deepEqual(await statusOf(s), { one: "online", two: "online", three: "offline" });
  assert.equal(net.asked(STREAM("s.example", "shared")).length, 1);
});

test("a run takes no revision for its verdicts, and the public answer never carries them", async () => {
  const net = fakeNet();
  net.set(STREAM("s.example", "a"), MANIFEST);
  const s = await setupSync(net, [m3uEntry("a", STREAM("s.example", "a")), m3uEntry("b", STREAM("s.example", "b"))]);
  const rows = await s.channels();
  await s.api("PATCH", "/api/channels", { enabled: true, ids: rows.map((r) => String(r.id)) });
  const before = await s.revision();
  await s.run();
  assert.equal(await s.revision(), before, "statuses, check times and cache files are admin-only");
  const publicRows = pick((await send(s.t.app, "GET", "/api/channels")).body, "data.items") as Array<Record<string, unknown>>;
  assert.equal(publicRows.length, 2);
  assert.ok(publicRows.every((r) => !("status" in r) && !("checkedAt" in r) && !("cachedLogoUrl" in r)));
  const admin = await s.channels();
  assert.deepEqual(admin.map((c) => [c.name, c.status]), [["a", "online"], ["b", "offline"]]);
  assert.equal(new Set(admin.map((c) => c.revision)).size, 1, "no row's revision moved either");
});

test("a channel whose address changed mid-run keeps no verdict for the old address (compare-and-set)", async () => {
  const net = fakeNet();
  net.set(STREAM("s.example", "a"), MANIFEST);
  net.set(STREAM("s.example", "b"), MANIFEST);
  const s = await setupSync(net, [m3uEntry("a", STREAM("s.example", "a")), m3uEntry("b", STREAM("s.example", "b"))]);
  const gate = net.hold(STREAM("s.example", "a"));
  const id = String((await s.channels()).find((c) => c.name === "a")?.id);
  const run = s.run();
  await gate.started;
  const edited = await s.api("PATCH", `/api/channels/${id}`, { streamUrl: STREAM("elsewhere.example", "a2") });
  assert.equal(edited.status, 200);
  gate.release();
  await run;
  assert.deepEqual(await statusOf(s), { a: "unchecked", b: "online" }, "the old address's verdict matched no row");
});

test("the probe budget ends the check: the rest stay unchecked and a second run finishes them", async () => {
  const net = fakeNet();
  const names = Array.from({ length: 12 }, (_, i) => `c${i}`);
  for (const n of names) net.set(STREAM("s.example", n), MANIFEST);
  const s = await setupSync(net, names.map((n) => m3uEntry(n, STREAM("s.example", n))));
  net.onRequest((url) => {
    if (url.startsWith("https://s.example/")) {
      net.onRequest(undefined);
      s.t.clock.advance(PROBE_BUDGET_MS + 1);
    }
  });
  const partial = await s.run();
  assert.equal(partial.lastResult, "ok");
  const online = Number(pick(partial, "lastCounts.online"));
  assert.ok(online >= 1 && online < 12, `some checked (${online}), the rest not`);
  assert.equal(Number(pick(partial, "lastCounts.unchecked")), 12 - online);
  const first = net.asked("https://s.example/").length;
  const full = await s.run();
  assert.deepEqual([pick(full, "lastCounts.online"), pick(full, "lastCounts.unchecked")], [12, 0]);
  assert.ok(net.asked("https://s.example/").length > first);
});

test("the check order is total: never-checked first, then the longest unchecked, then the id", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "giga-health-order-"));
  const store = createStore(path.join(dir, "admin.db"));
  try {
    const playlistId = store.playlists.insert({ kind: "file", name: "p", fileName: "p.m3u", enabled: true }, 1);
    const row = (id: string, url: string) => ({
      id, name: id, category: "", number: null, logoUrl: null, revision: 1, enabled: false, published: false, kind: "stream" as const,
      streamUrl: url, tvgId: null, source: null, playlistName: null, syncName: id, playlistId, status: null, checkedAt: null,
      logoFile: null, logoCheckedAt: null, editedFields: [],
    });
    for (const id of ["d", "c", "b", "a"]) store.channels.insert(row(id, `https://x.example/${id}`), 1);
    store.health.writeVerdicts(playlistId, [{ url: "https://x.example/a", status: "online", at: 500 }, { url: "https://x.example/c", status: "offline", at: 100 }]);
    assert.deepEqual(store.health.streamUrls(playlistId).map((u) => u.slice(-1)), ["b", "d", "c", "a"]);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
