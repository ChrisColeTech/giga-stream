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
    "/api/jobs",
    "/api/providers",
    "/api/channels",
    "/api/titles?kind=movie",
    "/api/playlists",
    "/api/audit?limit=5",
    "/api/admin-accounts",
    "/api/admin-channels",
    "/api/admin-channels?limit=100",
    "/api/titles/stored",
    "/api/auth/me",
    "/api/auth/me/state",
  ]) {
    const answer = await send(t.app, "GET", url, undefined, token);
    // The titles list needs TMDB, which a test has no key for (503); the header is the same on any answer.
    if (!url.startsWith("/api/titles")) assert.equal(answer.status, 200, url);
    assert.equal(answer.headers["cache-control"], NO_STORE, url);
  }
});

test("an error answer from an authenticated route is no-store too", async () => {
  const t = await makeApp();
  const token = (await signIn(t.app)).access;
  for (const url of ["/api/jobs", "/api/playlists", "/api/audit", "/api/admin-accounts", "/api/titles/stored"]) {
    const refused = await send(t.app, "GET", url);
    assert.equal(refused.status, 401, url);
    assert.equal(refused.headers["cache-control"], NO_STORE, url);
  }
  const invalid = await send(t.app, "POST", "/api/playlists", { name: "" }, token);
  assert.equal(invalid.status, 422);
  assert.equal(invalid.headers["cache-control"], NO_STORE);
  const missing = await send(t.app, "GET", "/api/jobs/nope", undefined, token);
  assert.ok(missing.status >= 400);
  assert.equal(missing.headers["cache-control"], NO_STORE);
});

test("health, the admin app and the unsigned public reads keep their own headers", async () => {
  const t = await makeApp();
  for (const url of ["/healthz", "/api/channels", "/api/providers", "/api/titles/genres", "/admin/"]) {
    const answer = await send(t.app, "GET", url);
    assert.notEqual(answer.headers["cache-control"], NO_STORE, url);
  }
});
