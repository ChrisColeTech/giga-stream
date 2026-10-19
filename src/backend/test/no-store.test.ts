// Every admin API answer is `no-store` (docs/03 section 7): playlist addresses, job results and every other
// admin record are never cached by a browser or proxy. Public reads keep their caching headers.
import assert from "node:assert/strict";
import test from "node:test";

import { makeApp, send, signIn } from "./test-app.js";

const NO_STORE = "no-store";

test("a signed-in read of every admin route answers no-store", async () => {
  const t = await makeApp();
  const token = (await signIn(t.app)).access;
  for (const url of [
    "/api/admin/jobs",
    "/api/admin/providers",
    "/api/channels",
    "/api/admin/titles?kind=movie",
    "/api/admin/playlists",
    "/api/admin/audit?limit=5",
    "/api/admin/accounts",
    "/api/admin/channels",
    "/api/admin/channels?limit=100",
    "/api/admin/titles/stored",
    "/api/admin/auth/me",
    "/api/admin/account-state",
  ]) {
    const answer = await send(t.app, "GET", url, undefined, token);
    // `/api/admin/titles` itself is unrouted (404): an admin-namespace address is `no-store` on any answer.
    if (!url.startsWith("/api/admin/titles")) assert.equal(answer.status, 200, url);
    assert.equal(answer.headers["cache-control"], NO_STORE, url);
  }
});

test("an error answer from an authenticated route is no-store too", async () => {
  const t = await makeApp();
  const token = (await signIn(t.app)).access;
  for (const url of ["/api/admin/jobs", "/api/admin/playlists", "/api/admin/audit", "/api/admin/accounts", "/api/admin/titles/stored"]) {
    const refused = await send(t.app, "GET", url);
    assert.equal(refused.status, 401, url);
    assert.equal(refused.headers["cache-control"], NO_STORE, url);
  }
  const invalid = await send(t.app, "POST", "/api/admin/playlists", { name: "" }, token);
  assert.equal(invalid.status, 422);
  assert.equal(invalid.headers["cache-control"], NO_STORE);
  const missing = await send(t.app, "GET", "/api/admin/jobs/nope", undefined, token);
  assert.ok(missing.status >= 400);
  assert.equal(missing.headers["cache-control"], NO_STORE);
});

test("health, the admin app and the unsigned public reads keep their own headers", async () => {
  const t = await makeApp();
  for (const url of ["/healthz", "/api/channels", "/api/titles/genres", "/admin/"]) {
    const answer = await send(t.app, "GET", url);
    assert.notEqual(answer.headers["cache-control"], NO_STORE, url);
  }
});
