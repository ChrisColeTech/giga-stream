// The root-level admin UI (docs/26 section 4.1): `PUBLIC_DIR` with an `index.html` is served at `/` by @fastify/static,
// after every API route, so `/` answers the page and any other miss stays the JSON 404 envelope.
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { removeDir } from "./db-kit.js";
import test from "node:test";

import { makeApp, pick, send } from "./test-app.js";

test("GET / answers the built index.html and an unknown root path stays the JSON 404 envelope", async () => {
  const publicDir = mkdtempSync(path.join(os.tmpdir(), "giga-public-"));
  mkdirSync(publicDir, { recursive: true });
  writeFileSync(path.join(publicDir, "index.html"), "<!doctype html><title>Giga Stream admin</title>");
  try {
    const t = await makeApp({ config: { PUBLIC_DIR: publicDir } });
    const page = await send(t.app, "GET", "/");
    assert.equal(page.status, 200);
    assert.match(page.raw.toString("utf-8"), /Giga Stream admin/);
    assert.match(String(page.headers["content-type"] ?? ""), /text\/html/);
    const miss = await send(t.app, "GET", "/api/nope");
    assert.equal(miss.status, 404);
    assert.deepEqual(pick(miss.body, "error.code"), "route.not_found");
    const root = await send(t.app, "GET", "/nope");
    assert.equal(root.status, 404);
    assert.deepEqual(pick(root.body, "error.code"), "route.not_found");
    await t.dispose();
  } finally {
    removeDir(publicDir);
  }
});

test("without an index.html nothing is served at /: the root is the JSON 404 envelope", async () => {
  const publicDir = mkdtempSync(path.join(os.tmpdir(), "giga-public-empty-"));
  try {
    const t = await makeApp({ config: { PUBLIC_DIR: publicDir } });
    const root = await send(t.app, "GET", "/");
    assert.equal(root.status, 404);
    assert.deepEqual(pick(root.body, "error.code"), "route.not_found");
    await t.dispose();
  } finally {
    removeDir(publicDir);
  }
});
