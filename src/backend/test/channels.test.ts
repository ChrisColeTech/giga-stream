import test from "node:test";
import assert from "node:assert/strict";

import { makeApp, pick, send } from "./test-app.js";

const news = { name: "News", category: "News", number: "7", streamUrl: "https://live.example/news.m3u8" };

test("health answers role, version, revision and TMDB state in the envelope", async () => {
  const t = await makeApp();
  const answer = await send(t.app, "GET", "/healthz");
  assert.equal(answer.status, 200);
  assert.deepEqual(answer.body, { ok: true, data: { role: "admin-backend", version: "0.1.0", revision: 0, tmdb: "absent" } });
});

test("a new backend lists no channels at revision 0, with no sign-in", async () => {
  const t = await makeApp();
  assert.deepEqual((await send(t.app, "GET", "/api/channels")).body, { ok: true, data: { items: [], revision: 0 } });
});

test("a change needs a signed-in admin: no token and a bad one are auth.unauthorized", async () => {
  const t = await makeApp();
  for (const token of [undefined, "not-a-token"]) {
    const answer = await send(t.app, "POST", "/api/channels", news, token);
    assert.equal(answer.status, 401);
    assert.equal(pick(answer.body, "error.code"), "auth.unauthorized");
  }
  assert.equal(pick((await send(t.app, "GET", "/api/channels")).body, "data.items.length"), 0);
});