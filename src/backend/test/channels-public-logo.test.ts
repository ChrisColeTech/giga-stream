// The public channel answer's `cachedLogoUrl` (docs/46 D.1, docs/03 section 7.2): an absolute address of the backend's
// hash-named cached logo for a stream row that has one; absent otherwise; no revision bump; the admin's stays relative.
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

import { DATABASE_FILE_NAME } from "../src/constants/deployment.js";
import { NOT_SYNCED, type StreamRecord } from "../src/types/channel.js";
import { liveBody } from "./live-channel-kit.js";
import { seededDataDir } from "./paging-kit.js";
import { makeApp, pick, request, send, signIn } from "./test-app.js";

const FILE = `${"a".repeat(32)}.png`;
const stream = (id: string, number: string): StreamRecord => ({
  ...NOT_SYNCED, kind: "stream", id, name: id, category: "News", number, logoUrl: `https://img.example/${id}.png`,
  tvgId: null, streamUrl: `https://s.example/${id}.m3u8`, revision: 1, enabled: true, published: true, editedFields: [],
});

function seededApp() {
  const dataDir = seededDataDir((store) => {
    store.channels.insert(stream("cached", "1"), 1);
    store.channels.insert(stream("plain", "2"), 1);
  });
  const db = new DatabaseSync(path.join(dataDir, DATABASE_FILE_NAME));
  db.exec(`UPDATE channels SET logo_file = '${FILE}', logo_checked_at = 5 WHERE id = 'cached'`);
  db.close();
  return makeApp({ dataDir });
}

const byId = (body: unknown, id: string): Record<string, unknown> => {
  const items = pick(body, "data.items");
  const found = Array.isArray(items) ? items.find((item) => pick(item, "id") === id) : undefined;
  assert.ok(found, `channel ${id} missing`);
  return found as Record<string, unknown>;
};

test("a stream row with a cached logo carries it absolute from the request origin; others do not", async () => {
  const t = await seededApp();
  const answer = await request(t.app, { method: "GET", url: "/api/channels", headers: { host: "lan.example:8091" } });
  assert.equal(answer.status, 200);
  assert.equal(byId(answer.body, "cached").cachedLogoUrl, `http://lan.example:8091/logos/c/${FILE}`);
  assert.equal("cachedLogoUrl" in byId(answer.body, "plain"), false);
  const one = await request(t.app, { method: "GET", url: "/api/channels/cached", headers: { host: "other.example" } });
  assert.equal(pick(one.body, "data.cachedLogoUrl"), `http://other.example/logos/c/${FILE}`);
});

test("a live row never carries it, the revision is unchanged, and the admin's answer is still relative", async () => {
  const t = await seededApp();
  const token = (await signIn(t.app)).access;
  const before = await send(t.app, "GET", "/api/channels");
  assert.equal((await send(t.app, "POST", "/api/channels", liveBody({ id: "home", number: 900 }), token)).status, 201);
  await t.live.settled();
  const after = await send(t.app, "GET", "/api/channels");
  assert.equal("cachedLogoUrl" in byId(after.body, "home"), false);
  assert.equal(pick(after.body, "data.revision"), Number(pick(before.body, "data.revision")) + 1, "only the live create bumped it");
  const again = await send(t.app, "GET", "/api/channels");
  assert.equal(pick(again.body, "data.revision"), pick(after.body, "data.revision"), "reading changes nothing");

  const admin = await send(t.app, "GET", "/api/admin-channels?limit=200", undefined, token);
  assert.equal(byId(admin.body, "cached").cachedLogoUrl, `/logos/c/${FILE}`);
  assert.equal("cachedLogoUrl" in byId(admin.body, "plain"), false);
});
