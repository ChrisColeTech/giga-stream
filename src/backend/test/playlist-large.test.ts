// The saved playlists/us.m3u (about 2,600 entries) through the real routes: it imports in seconds in one revision, and
// uploading it again is `0 created, 0 updated` with no revision bump and the same row ids (docs/43 section 4.3).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { setupPlaylists, uploadFile } from "./playlist-kit.js";
import { pick } from "./test-app.js";

const US = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "playlists", "us.m3u");
const SECONDS = 1000;
const IMPORT_BUDGET_MS = 10 * SECONDS;

test("us.m3u imports in one request and one revision; uploading it again changes nothing", async () => {
  const { t, token, api, revision, adminChannels } = await setupPlaylists();
  const text = readFileSync(US, "utf-8");
  const before = await revision();
  const started = Date.now();
  const first = await uploadFile(t, token, "us.m3u", text);
  assert.equal(first.status, 201);
  assert.ok(Date.now() - started < IMPORT_BUDGET_MS, "answers in seconds");
  const created = Number(pick(first.body, "data.imported.created"));
  assert.ok(created > 2000, `most of the entries became channels (${created})`);
  assert.equal(pick(first.body, "data.channels"), created);
  assert.equal(pick(first.body, "data.enabledChannels"), 0, "all disabled");
  assert.equal(await revision(), before + 1);
  const ids = (await adminChannels()).map((r) => r.id);
  assert.equal(ids.length, created);

  const again = await uploadFile(t, token, "us.m3u", text);
  assert.deepEqual([again.status, pick(again.body, "data.imported.created"), pick(again.body, "data.imported.updated")], [200, 0, 0]);
  assert.equal(await revision(), before + 1, "no bump");
  assert.deepEqual((await adminChannels()).map((r) => r.id), ids, "same row ids");
  assert.equal(pick((await api("GET", "/api/admin/playlists")).body, "data.items.length"), 1);
});
