import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { makeApp, pick, send } from "./app-fixture.js";

/** A dist as Vite emits it: the entry at the root, the bundle under `assets/` (22 section 5.2). */
function makeDist(files: string[]): string {
  const dist = mkdtempSync(path.join(os.tmpdir(), "giga-web-dist-"));
  for (const file of files) {
    const target = path.join(dist, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, `<${file}>`);
  }
  return dist;
}

test("the built bundle's assets and the favicon serve; the SPA entry answers deep links", async () => {
  const dist = makeDist(["index.html", "favicon.ico", "assets/app.js"]);
  const t = await makeApp({ webDist: dist });

  const root = await t.app.inject({ method: "GET", url: "/" });
  assert.equal(root.statusCode, 200);
  assert.equal(root.body, "<index.html>");

  const bundle = await t.app.inject({ method: "GET", url: "/assets/app.js" });
  assert.equal(bundle.statusCode, 200, "Vite's output folder is served (22 section 5.2)");
  assert.equal(bundle.body, "<assets/app.js>");

  const favicon = await t.app.inject({ method: "GET", url: "/favicon.ico" });
  assert.equal(favicon.statusCode, 200);
  assert.equal(favicon.body, "<favicon.ico>");

  const deep = await t.app.inject({ method: "GET", url: "/some/deep/link" });
  assert.equal(deep.statusCode, 200, "a deep link answers the SPA entry");
  assert.match(String(deep.headers["content-type"]), /^text\/html/);
  assert.equal(deep.body, "<index.html>");
  await t.dispose();
  rmSync(dist, { recursive: true, force: true });
});

test("an unknown /api or /healthz address stays the JSON 404 envelope, never the SPA entry", async () => {
  const dist = makeDist(["index.html", "assets/app.js"]);
  const t = await makeApp({ webDist: dist });
  const answer = await send(t.app, "GET", "/api/nope");
  assert.equal(answer.status, 404);
  assert.equal(pick(answer.body, "error.code"), "route.not_found");
  const health = await send(t.app, "GET", "/healthz/nope");
  assert.equal(health.status, 404);
  assert.equal(pick(health.body, "error.code"), "route.not_found");
  // The SPA entry is a GET answer only: a POST deep link keeps the envelope.
  const posted = await send(t.app, "POST", "/some/deep/link");
  assert.equal(posted.status, 404);
  assert.equal(pick(posted.body, "error.code"), "route.not_found");
  await t.dispose();
  rmSync(dist, { recursive: true, force: true });
});

test("without an index.html the dist has no SPA entry and unknown paths stay 404", async () => {
  const dist = makeDist(["assets/app.js"]);
  const t = await makeApp({ webDist: dist });
  const deep = await send(t.app, "GET", "/some/deep/link");
  assert.equal(deep.status, 404);
  assert.equal(pick(deep.body, "error.code"), "route.not_found");
  await t.dispose();
  rmSync(dist, { recursive: true, force: true });
});

test("a served segment with no file behind it stays 404 instead of the SPA entry", async () => {
  const dist = makeDist(["index.html", "assets/app.js"]);
  const t = await makeApp({ webDist: dist });
  const missing = await send(t.app, "GET", "/assets/missing.js");
  assert.equal(missing.status, 404);
  assert.equal(pick(missing.body, "error.code"), "route.not_found");
  await t.dispose();
  rmSync(dist, { recursive: true, force: true });
});
