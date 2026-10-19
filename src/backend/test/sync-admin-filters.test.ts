// What a finished sync shows the admin (docs/43 section 3.3): `status` and `playlist` filters over real verdicts, and the
// admin-only `status`, `checkedAt` and `cachedLogoUrl` on a stream row; the playlist view's counts follow.
import assert from "node:assert/strict";
import test from "node:test";

import { pick } from "./test-app.js";
import { LOGO, MANIFEST, PNG, STREAM, fakeNet, image, m3uEntry, setupSync, type Sync } from "./sync-kit.js";

async function synced() {
  const net = fakeNet();
  net.set(STREAM("s.example", "up"), MANIFEST);
  net.set(STREAM("s.example", "down"), { status: 503 });
  net.set(LOGO("up"), image(PNG));
  const s = await setupSync(net, [m3uEntry("Up", STREAM("s.example", "up"), LOGO("up")), m3uEntry("Down", STREAM("s.example", "down"))]);
  await s.api("POST", "/api/admin/channels", { name: "Hand", category: "x", streamUrl: "https://hand.example/h.m3u8" });
  await s.run();
  return s;
}

const names = async (s: Sync, query: string): Promise<string[]> => {
  const answer = await s.api("GET", `/api/admin/channels?limit=50${query}`);
  assert.equal(answer.status, 200, query);
  return ((pick(answer.body, "data.items") as Array<Record<string, unknown>>).map((c) => String(c.name))).sort();
};

test("the status filter keeps online, offline or never-checked stream rows; the playlist filter keeps one playlist's", async () => {
  const s = await synced();
  assert.deepEqual(await names(s, "&status=online"), ["Up"]);
  assert.deepEqual(await names(s, "&status=offline"), ["Down"]);
  assert.deepEqual(await names(s, "&status=unchecked"), ["Hand"], "a hand-made channel is never checked");
  assert.deepEqual(await names(s, "&playlist=1"), ["Down", "Up"]);
  assert.deepEqual(await names(s, "&playlist=1&status=offline"), ["Down"]);
  assert.deepEqual(await names(s, "&playlist=99"), []);
  assert.deepEqual(await names(s, "&q=list.m3u"), ["Down", "Up"], "q matches the playlist's name");
});

test("a stream row carries its verdict, check time and relative cached logo address; the playlist view counts follow", async () => {
  const s = await synced();
  const rows = await s.channels();
  const up = rows.find((r) => r.name === "Up") ?? {};
  assert.equal(up.status, "online");
  assert.equal(up.checkedAt, s.t.clock.now());
  assert.match(String(up.cachedLogoUrl), /^\/logos\/c\/[0-9a-f]{32}\.png$/);
  assert.equal(up.logoUrl, LOGO("up"));
  const down = rows.find((r) => r.name === "Down") ?? {};
  assert.deepEqual([down.status, down.cachedLogoUrl], ["offline", undefined]);
  const hand = rows.find((r) => r.name === "Hand") ?? {};
  assert.deepEqual([hand.status, hand.checkedAt, hand.cachedLogoUrl], [undefined, undefined, undefined]);
  const view = (await s.api("GET", "/api/admin/playlists/1")).body;
  assert.deepEqual(["channels", "online", "offline"].map((f) => pick(view, `data.${f}`)), [2, 1, 1]);
});

test("a channel edited to another address loses its verdict, and one edited to another logo loses its cached file", async () => {
  const s = await synced();
  const up = (await s.channels()).find((r) => r.name === "Up") ?? {};
  const changed = await s.api("PATCH", `/api/admin/channels/${String(up.id)}`, { streamUrl: STREAM("s.example", "elsewhere"), logoUrl: LOGO("new") });
  assert.deepEqual(
    [pick(changed.body, "data.status"), pick(changed.body, "data.checkedAt"), pick(changed.body, "data.cachedLogoUrl")],
    [undefined, undefined, undefined],
  );
  const down = (await s.channels()).find((r) => r.name === "Down") ?? {};
  const renamed = await s.api("PATCH", `/api/admin/channels/${String(down.id)}`, { name: "Renamed" });
  assert.deepEqual([pick(renamed.body, "data.status"), pick(renamed.body, "data.checkedAt")], ["offline", s.t.clock.now()], "a rename keeps the verdict");
});
