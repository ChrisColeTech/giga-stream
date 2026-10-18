// `GET /logos/c/<file>` (docs/43 section 3.3): the cached images, by content-hash name only, public, immutable, nosniff;
// nothing outside the cache folder is reachable; the live channel logos at `/logos/<id>.png` are unchanged.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { liveBody } from "./live-channel-kit.js";
import { PNG, JPEG, SVG } from "./sync-kit.js";
import { makeApp, send, signIn } from "./test-app.js";

const NAME = (ch: string, ext: string): string => `${ch.repeat(32)}.${ext}`;

async function withCache() {
  const t = await makeApp();
  const dir = path.join(t.dataDir, "logo-cache");
  mkdirSync(dir);
  writeFileSync(path.join(dir, NAME("a", "png")), PNG);
  writeFileSync(path.join(dir, NAME("b", "jpg")), JPEG);
  writeFileSync(path.join(dir, NAME("c", "png")), SVG);
  writeFileSync(path.join(t.dataDir, "secret.png"), PNG);
  return t;
}

test("a cached image is served to anyone, with its own type, immutable caching and nosniff", async () => {
  const t = await withCache();
  const png = await t.app.inject({ method: "GET", url: `/logos/c/${NAME("a", "png")}` });
  assert.equal(png.statusCode, 200);
  assert.deepEqual(
    [png.headers["content-type"], png.headers["cache-control"], png.headers["x-content-type-options"]],
    ["image/png", "public, max-age=31536000, immutable", "nosniff"],
  );
  assert.equal(png.rawPayload.equals(PNG), true);
  const jpg = await t.app.inject({ method: "GET", url: `/logos/c/${NAME("b", "jpg")}` });
  assert.deepEqual([jpg.statusCode, jpg.headers["content-type"]], [200, "image/jpeg"]);
  const head = await t.app.inject({ method: "HEAD", url: `/logos/c/${NAME("a", "png")}` });
  assert.equal(head.statusCode, 200);
});

test("only an exact cache name is served: other names and traversal are refused, an unknown file is 404", async () => {
  const t = await withCache();
  for (const bad of [
    "secret.png", `${"a".repeat(31)}.png`, `${"a".repeat(33)}.png`, `${"A".repeat(32)}.png`, `${"a".repeat(32)}.svg`,
    `${"a".repeat(32)}.png.tmp`, "..%2fsecret.png", "%2e%2e%2fsecret.png", "..%5csecret.png", `x%00${"a".repeat(32)}.png`,
  ]) {
    const got = await t.app.inject({ method: "GET", url: `/logos/c/${bad}` });
    assert.ok([400, 404].includes(got.statusCode), `${bad} -> ${got.statusCode}`);
    assert.equal(got.headers["content-type"]?.toString().startsWith("image/"), false, bad);
  }
  const traversal = await t.app.inject({ method: "GET", url: "/logos/c/../../secret.png" });
  assert.notEqual(traversal.statusCode, 200);
  const unknown = await t.app.inject({ method: "GET", url: `/logos/c/${NAME("d", "gif")}` });
  assert.deepEqual([unknown.statusCode, unknown.json().error.code], [404, "media.not_found"]);
  const notImage = await t.app.inject({ method: "GET", url: `/logos/c/${NAME("c", "png")}` });
  assert.equal(notImage.statusCode, 404, "a file whose bytes are not an image (an SVG here) is never served");
});

test("a live channel's own logo is still at /logos/<id>.png", async () => {
  const t = await withCache();
  const token = (await signIn(t.app)).access;
  await send(t.app, "POST", "/api/channels", liveBody({ id: "home" }), token);
  const logo = await t.app.inject({ method: "GET", url: "/logos/home.png" });
  assert.deepEqual([logo.statusCode, logo.headers["content-type"]], [200, "image/png"]);
});
