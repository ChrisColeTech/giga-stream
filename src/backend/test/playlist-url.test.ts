// The web-address import (docs/43 sections 3.2 and 7): the address is fetched once through the guarded fetch, parsed,
// then written in one transaction; a failure creates nothing; the admin reads the address in full, but no audit entry, job, refusal example or error repeats it.
import assert from "node:assert/strict";
import test from "node:test";

import { ONE, TWO, M3U, setupPlaylists } from "./playlist-kit.js";
import { pick, send } from "./test-app.js";

const SECRETS = ["SECRET-VALUE", "ANOTHER-SECRET", "token=", "key=", "lists/us"];

test("importing needs a signed-in admin", async () => {
  const { t } = await setupPlaylists();
  for (const token of [undefined, "not-a-token"]) {
    const answer = await send(t.app, "POST", "/api/playlists", { url: ONE }, token);
    assert.deepEqual([answer.status, pick(answer.body, "error.code")], [401, "auth.unauthorized"]);
  }
});

test("an address is fetched once and becomes a playlist with disabled channels and a job; only the playlist reads show the address", async () => {
  const { api, feed, adminChannels, revision, audit } = await setupPlaylists();
  const before = await revision();
  const made = await api("POST", "/api/playlists", { url: ONE });
  assert.equal(made.status, 201);
  assert.deepEqual(
    ["name", "kind", "url", "host", "fileName", "created", "masked"].map((f) => pick(made.body, `data.${f}`)),
    ["us", "url", ONE, "cdn.example", undefined, true, undefined],
  );
  assert.deepEqual(pick(made.body, "data.imported"), { created: 2, updated: 0, skipped: 0, refused: 0, refusalExamples: [] });
  assert.deepEqual(feed.asked, [ONE], "one fetch");
  assert.equal(await revision(), before + 1);
  assert.deepEqual((await adminChannels()).map((r) => [r.name, r.enabled, r.source]), [["ABC", false, "cdn.example"], ["ESPN", false, "cdn.example"]]);
  assert.equal(pick((await api("GET", "/api/playlists")).body, "data.items.0.url"), ONE, "the list shows the address in full");
  assert.equal(pick((await api("GET", "/api/playlists/1")).body, "data.url"), ONE, "so does a read");
  const reads = [pick(made.body, "data.imported"), (await api("GET", "/api/jobs")).body, await audit(), await adminChannels()];
  const text = JSON.stringify(reads);
  for (const secret of SECRETS) assert.equal(text.includes(secret), false, secret);
  assert.deepEqual(pick(await audit(), "0.detail.source"), "cdn.example");
});

test("a typed name is kept and is 409 when held, ignoring case; a derived name that clashes is suffixed; an address is held once", async () => {
  const { api, feed, importUrl } = await setupPlaylists();
  const typed = await importUrl(ONE, { name: "Cable", enabled: false });
  assert.deepEqual([typed.status, pick(typed.body, "data.name"), pick(typed.body, "data.enabled")], [201, "Cable", false]);
  const clash = await importUrl(TWO, { name: "cable" });
  assert.deepEqual([clash.status, pick(clash.body, "error.code"), pick(clash.body, "error.details.field")], [409, "playlist.taken", "name"]);
  const held = await importUrl(ONE);
  assert.deepEqual([held.status, pick(held.body, "error.code"), pick(held.body, "error.details.field")], [409, "playlist.taken", "url"]);
  await importUrl(TWO);
  feed.set("https://third.example/all.m3u", M3U);
  const derived = await importUrl("https://third.example/all.m3u");
  assert.deepEqual([derived.status, pick(derived.body, "data.name")], [201, "all (2)"], "a derived clash is suffixed");
  feed.set("https://host-only.example/", M3U);
  assert.equal(pick(await importUrl("https://host-only.example/"), "body.data.name"), "host-only.example", "no path: the host");
  assert.equal(pick((await api("GET", "/api/playlists")).body, "data.items.length"), 4);
});

test("an address that breaks the rule is 422 on url; unknown fields are refused", async () => {
  const { api, feed } = await setupPlaylists();
  for (const url of ["http://cdn.example/a.m3u", "ftp://x/a", "not a url", "https://user:pw@cdn.example/a.m3u",
    "https://10.0.0.5/a.m3u", "https://127.0.0.1/a.m3u", "https://[::1]/a.m3u", "https://169.254.169.254/latest", "https://[::ffff:10.0.0.5]/a"]) {
    const refused = await api("POST", "/api/playlists", { url });
    assert.deepEqual([refused.status, pick(refused.body, "error.code"), pick(refused.body, "error.details.field")], [422, "playlist.invalid", "url"], url);
  }
  assert.equal((await api("POST", "/api/playlists", { url: ONE, colour: "red" })).status, 422);
  assert.deepEqual(feed.asked, [], "nothing was fetched");
});

test("a fetch that fails, a body that is no playlist, or an address the guard refuses creates nothing", async () => {
  const { api, feed, revision, importUrl } = await setupPlaylists();
  const before = await revision();
  const cases: Array<[string, number, string]> = [
    ["safe_fetch.timeout", 503, "playlist.unreachable"], ["safe_fetch.failed", 503, "playlist.unreachable"],
    ["safe_fetch.too_many_redirects", 503, "playlist.unreachable"], ["safe_fetch.blocked_address", 422, "playlist.invalid"],
    ["safe_fetch.too_large", 422, "playlist.invalid"], ["safe_fetch.redirect_refused", 422, "playlist.invalid"],
  ];
  for (const [code, status, expected] of cases) {
    feed.fail(ONE, code as never);
    const answer = await importUrl(ONE);
    assert.deepEqual([answer.status, pick(answer.body, "error.code")], [status, expected], code);
    assert.equal(JSON.stringify(answer.body).includes("SECRET-VALUE"), false, "no address in the error");
  }
  feed.heal(ONE);
  feed.set(ONE, "<html>not a playlist</html>");
  assert.deepEqual([(await importUrl(ONE)).status, (await importUrl(ONE)).status], [422, 422]);
  assert.equal(pick((await importUrl("https://gone.example/none.m3u")).body, "error.code"), "playlist.unreachable", "a 404");
  assert.equal(pick((await api("GET", "/api/playlists")).body, "data.items.length"), 0);
  assert.equal(pick((await api("GET", "/api/jobs")).body, "data.items.length"), 1, "only the seeded catalog job");
  assert.equal(await revision(), before);
});

test("two imports of one address at once: one wins, the other is 409 playlist.taken", async () => {
  const { api, importUrl } = await setupPlaylists();
  const [a, b] = await Promise.all([importUrl(ONE), importUrl(ONE)]);
  assert.deepEqual([a.status, b.status].sort(), [201, 409]);
  assert.equal(pick(([a, b].find((x) => x.status === 409))?.body, "error.code"), "playlist.taken");
  assert.equal(pick((await api("GET", "/api/admin-channels")).body, "data.items.length"), 2, "one set of channels");
});
