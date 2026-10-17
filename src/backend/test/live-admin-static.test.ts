// The built admin app at /admin/ (docs/26 section 4.1): files, the index.html fallback, and nothing without a build.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";

import { makeApp, pick, send } from "./test-app.js";

const roots: string[] = [];
after(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

/** A folder standing in for `src/admin/dist`, with a file beside it that must never be reachable. */
function dist(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(os.tmpdir(), "giga-admin-dist-"));
  roots.push(root);
  writeFileSync(path.join(root, "outside.txt"), "secret");
  const folder = path.join(root, "dist");
  mkdirSync(folder);
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(folder, name)), { recursive: true });
    writeFileSync(path.join(folder, name), content);
  }
  return folder;
}

const BUILT = {
  "index.html": "<!doctype html><title>Giga Stream admin</title>",
  "assets/app-1a2b.js": "console.log('admin');",
  "assets/app-1a2b.css": "body{margin:0}",
  "favicon.svg": "<svg xmlns='http://www.w3.org/2000/svg'/>",
  "assets/JetBrainsMono-Regular-abc.woff2": "font-bytes",
  "assets/face-abc.ttf": "font-bytes",
  ".hidden": "no",
};

const notFound = (answer: { status: number; body: unknown }) => [answer.status, pick(answer.body, "error.code")];

test("with no index.html in ADMIN_DIST nothing is served at /admin/", async () => {
  const t = await makeApp({ config: { ADMIN_DIST: dist({}) } });
  for (const url of ["/admin", "/admin/", "/admin/index.html", "/admin/assets/app.js", "/admin/channels"]) {
    assert.deepEqual(notFound(await send(t.app, "GET", url)), [404, "route.not_found"], url);
  }
  assert.equal((await send(t.app, "GET", "/healthz")).status, 200);
  const missing = await makeApp({ config: { ADMIN_DIST: path.join(os.tmpdir(), "giga-admin-dist-does-not-exist") } });
  assert.deepEqual(notFound(await send(missing.app, "GET", "/admin/")), [404, "route.not_found"]);
});

test("the built app is served: files by type, the page uncached, fingerprinted assets immutable", async () => {
  const t = await makeApp({ config: { ADMIN_DIST: dist(BUILT) } });
  const index = await send(t.app, "GET", "/admin/");
  assert.deepEqual([index.status, index.headers["content-type"], index.headers["cache-control"]], [200, "text/html; charset=utf-8", "no-cache"]);
  assert.equal(index.raw.toString(), BUILT["index.html"]);
  assert.equal(index.headers["x-content-type-options"], "nosniff");
  const script = await send(t.app, "GET", "/admin/assets/app-1a2b.js");
  assert.deepEqual([script.status, script.headers["content-type"]], [200, "text/javascript; charset=utf-8"]);
  assert.match(String(script.headers["cache-control"]), /immutable/);
  assert.equal((await send(t.app, "GET", "/admin/assets/app-1a2b.css")).headers["content-type"], "text/css; charset=utf-8");
  const icon = await send(t.app, "GET", "/admin/favicon.svg");
  assert.deepEqual([icon.headers["content-type"], icon.headers["cache-control"]], ["image/svg+xml", "no-cache"]);
  assert.equal((await send(t.app, "GET", "/admin/index.html")).status, 200);
  const head = await send(t.app, "HEAD", "/admin/");
  assert.deepEqual([head.status, head.raw.length], [200, 0]);
});

test("fonts get their font types, fingerprinted; the page cannot be framed", async () => {
  const t = await makeApp({ config: { ADMIN_DIST: dist(BUILT) } });
  const woff = await send(t.app, "GET", "/admin/assets/JetBrainsMono-Regular-abc.woff2");
  assert.deepEqual([woff.status, woff.headers["content-type"]], [200, "font/woff2"]);
  assert.match(String(woff.headers["cache-control"]), /immutable/);
  assert.equal((await send(t.app, "GET", "/admin/assets/face-abc.ttf")).headers["content-type"], "font/ttf");
  const index = await send(t.app, "GET", "/admin/");
  assert.deepEqual([index.headers["x-frame-options"], index.headers["referrer-policy"]], ["DENY", "same-origin"]);
});

test("an app path with no extension opens the page; a missing file, a dotfile or a write does not", async () => {
  const t = await makeApp({ config: { ADMIN_DIST: dist(BUILT) } });
  for (const url of ["/admin/channels", "/admin/channels/home", "/admin/a/b/c"]) {
    const answer = await send(t.app, "GET", url);
    assert.deepEqual([answer.status, answer.raw.toString()], [200, BUILT["index.html"]], url);
  }
  assert.deepEqual(notFound(await send(t.app, "GET", "/admin/assets/missing.js")), [404, "route.not_found"]);
  assert.deepEqual(notFound(await send(t.app, "GET", "/admin/.hidden")), [404, "route.not_found"]);
  assert.deepEqual(notFound(await send(t.app, "POST", "/admin/", {})), [404, "route.not_found"]);
  const redirect = await t.app.inject({ method: "GET", url: "/admin" });
  assert.deepEqual([redirect.statusCode, redirect.headers.location], [302, "/admin/"]);
});

test("a path cannot climb out of the folder", async () => {
  const t = await makeApp({ config: { ADMIN_DIST: dist(BUILT) } });
  for (const url of ["/admin/%2e%2e/outside.txt", "/admin/..%2foutside.txt", "/admin/assets/..%5c..%5coutside.txt",
    "/admin/assets/%2e%2e/%2e%2e/outside.txt", "/admin/%00"]) {
    const answer = await send(t.app, "GET", url);
    assert.notEqual(answer.raw.toString(), "secret", url);
    assert.ok([400, 404].includes(answer.status), `${url} -> ${answer.status}`);
  }
});

test("a build made after the backend started is served without a restart, and /api is untouched", async () => {
  const folder = dist({});
  const t = await makeApp({ config: { ADMIN_DIST: folder } });
  assert.equal((await send(t.app, "GET", "/admin/")).status, 404);
  writeFileSync(path.join(folder, "index.html"), BUILT["index.html"]);
  assert.equal((await send(t.app, "GET", "/admin/")).status, 200);
  assert.equal(pick((await send(t.app, "GET", "/api/channels")).body, "ok"), true);
  assert.equal(pick((await send(t.app, "GET", "/api/nothing")).body, "error.code"), "route.not_found");
});
