// The admin's view of a synced title lists the fields it edited; a public read does not. The edit and revert entries
// name the title (docs/29 section 18, B5).
import assert from "node:assert/strict";
import test from "node:test";

import { field, syncAll, titleApp } from "./title-edit-kit.js";
import { pick, send, signIn } from "./test-app.js";

test("the admin's view of an edited synced title lists the edited fields; a public read does not", async () => {
  const h = await titleApp();
  await syncAll(h);
  const token = (await signIn(h.t.app)).access;
  await send(h.t.app, "PATCH", "/api/titles/movie-603", { plot: "My plot", rating: 5 }, token);

  const admin = await send(h.t.app, "GET", "/api/titles/movie-603?includeDisabled=true", undefined, token);
  const edited = field(admin, "editedFields");
  assert.ok(Array.isArray(edited));
  assert.deepEqual([...edited].sort(), ["plot", "rating"]);

  const pub = await send(h.t.app, "GET", "/api/titles/movie-603");
  assert.deepEqual([field(pub, "state"), field(pub, "editedFields")], ["edited", undefined]);
});

test("an edit and a revert of a synced title name it in the audit log", async () => {
  const h = await titleApp();
  await syncAll(h);
  const token = (await signIn(h.t.app)).access;
  await send(h.t.app, "PATCH", "/api/titles/movie-603", { plot: "My plot" }, token);
  const reverted = await send(h.t.app, "POST", "/api/titles/movie-603/revert", undefined, token);
  assert.equal(reverted.status, 200);
  assert.equal(field(reverted, "state"), "synced");

  const log = pick((await send(h.t.app, "GET", "/api/audit?limit=20", undefined, token)).body, "data.items");
  const find = (action: string): unknown =>
    Array.isArray(log) ? log.find((e) => pick(e, "action") === action) : undefined;
  assert.equal(pick(find("title.updated"), "detail.name"), "The Matrix");
  assert.equal(pick(find("title.reverted"), "detail.name"), "The Matrix");
});
