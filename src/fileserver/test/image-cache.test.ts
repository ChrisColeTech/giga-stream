import test from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildApp } from "../src/build-app.js";
import { imageIdOf, rewriteImageUrl, createImageCacheService, type ImageCacheService } from "../src/services/image-cache-service.js";
import { AppError } from "../src/lib/app-error.js";
import { errorEnvelope } from "../src/lib/envelope.js";

const at = Date.UTC(2026, 9, 16, 12);

interface ImageApp {
  url: string;
  close(): Promise<void>;
}

/** A real server serving `/api/images/:imageId` through the service, so no reply is stubbed. */
function rawApp(images: ImageCacheService): Promise<ImageApp> {
  const server: Server = createServer((request, response) => {
    const id = new URL(String(request.url), "http://local").pathname.replace("/api/images/", "");
    images
      .serve(id, request.method === "HEAD", response)
      .catch((error: unknown) => {
        const appError = error instanceof AppError ? error : new AppError("internal.failure", 500, "unexpected");
        response.statusCode = appError.status;
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify(errorEnvelope(appError.code, appError.message)));
      });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") throw new Error("no port");
      resolve({
        url: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

function jpegBackend(calls: string[]): typeof fetch {
  return (async (input) => {
    calls.push(String(input instanceof Request ? input.url : input));
    return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "image/jpeg" } });
  }) as typeof fetch;
}

test("image addresses: https and loopback http are rewritten, public http is not", () => {
  const url = "https://image.example.test/poster.jpg?x=1";
  assert.equal(rewriteImageUrl(url), `/api/images/${imageIdOf(url)}`);
  assert.equal(imageIdOf(url).length, 32);
  assert.equal(imageIdOf(url), imageIdOf("https://image.example.test/poster.jpg?x=1"));
  assert.match(rewriteImageUrl("http://127.0.0.1:9000/logo.png") ?? "", /^\/api\/images\//);
  assert.match(rewriteImageUrl("http://localhost:9000/logo") ?? "", /^\/api\/images\//);
  assert.equal(rewriteImageUrl("http://image.example.test/logo"), undefined);
  assert.equal(rewriteImageUrl("not an address"), undefined);
});

test("a remember-first source: the cache fetches once, then serves the file from disk", async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-images-"));
  const source = "https://image.example.test/poster.jpg?x=1";
  const calls: string[] = [];
  const images = createImageCacheService({ dataDir, fetch: jpegBackend(calls), now: () => at });
  images.rememberSource(source);
  const id = imageIdOf(source);

  const app = await rawApp(images);
  const first = await fetch(`${app.url}/api/images/${id}`);
  assert.equal(first.status, 200);
  assert.equal(String(first.headers.get("etag")), `"${id}"`);
  assert.match(String(first.headers.get("cache-control")), /max-age=31536000/);
  assert.equal(first.headers.get("content-type"), "image/jpeg");
  assert.deepEqual(new Uint8Array(await first.arrayBuffer()), new Uint8Array([1, 2, 3]));

  // The second request never reaches the source again.
  const second = await fetch(`${app.url}/api/images/${id}`);
  assert.equal(second.status, 200);
  assert.equal(calls.length, 1);
  await app.close();

  // A fresh fileserver (same disk) still serves it: the cache lives under DATA_DIR/images.
  const again = createImageCacheService({ dataDir, fetch: jpegBackend([]), now: () => at });
  assert.equal(again.has(id), true);
  rmSync(dataDir, { recursive: true, force: true });
});

test("a source-less id, a non-image answer, and an unrewritable shape all are 404 image.not_found", async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-images-"));
  const images = createImageCacheService({ dataDir, now: () => at });
  images.rememberSource("https://image.example.test/plain.txt");
  const app = await rawApp(images);
  const plainAnswer = await fetch(`${app.url}/api/images/${imageIdOf("https://image.example.test/plain.txt")}`);
  assert.equal(plainAnswer.status, 404);
  assert.equal(JSON.parse(String(await plainAnswer.text())).error.code, "image.not_found");
  assert.equal((await fetch(`${app.url}/api/images/nonsense`)).status, 404);
  const unbekannt = await fetch(`${app.url}/api/images/${imageIdOf("https://never-seen.example/x")}`);
  assert.equal(unbekannt.status, 404);
  await app.close();
  rmSync(dataDir, { recursive: true, force: true });
});

test("HEAD answers the head; a still file on disk keeps its id and its type", async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-images-"));
  const images = createImageCacheService({ dataDir, now: () => at });
  const stillId = imageIdOf("local:some/file.mp4");
  writeFileSync(path.join(images.dir, `${stillId}.png`), Buffer.from([9, 9, 9]));
  const app = await rawApp(images);
  assert.equal(images.has(stillId), true);
  const head = await fetch(`${app.url}/api/images/${stillId}`, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(String(await head.text()), "");
  assert.equal(head.headers.get("content-type"), "image/png");
  await app.close();
  rmSync(dataDir, { recursive: true, force: true });
});

test("prune deletes images older than six months and never younger ones", async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-images-"));
  const images = createImageCacheService({ dataDir, now: () => at });
  const oldId = imageIdOf("file:old");
  const freshId = imageIdOf("file:fresh");
  const oldFile = path.join(images.dir, `${oldId}.png`);
  writeFileSync(oldFile, Buffer.from([1]));
  writeFileSync(path.join(images.dir, `${freshId}.png`), Buffer.from([1]));
  utimesSync(oldFile, new Date(at - 200 * 86_400_000), new Date(at - 200 * 86_400_000));
  createImageCacheService({ dataDir, now: () => at + 91 * 86_400_000 }).prune();
  assert.equal(images.has(oldId), false);
  assert.equal(images.has(freshId), true);
  rmSync(dataDir, { recursive: true, force: true });
});

test("the live view answers each channel's logo through the image cache", async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-images-live-"));
  const good = "https://img.example.test/news.png";
  const refused = "http://far.example.test/logo.png";
  const answer = {
    ok: true,
    data: {
      items: [
        { id: "c1", name: "News", category: "News", revision: 3, streamUrl: "http://127.0.0.1:9/one.m3u8", logoUrl: good },
        { id: "c2", name: "Docs", category: "Fact", revision: 3, streamUrl: "http://127.0.0.1:9/two.m3u8", logoUrl: refused },
        {
          id: "c3", name: "Cached", category: "Fact", revision: 3, streamUrl: "http://127.0.0.1:9/three.m3u8",
          logoUrl: refused, cachedLogoUrl: "/logos/c/three.png",
        },
      ],
      revision: 9,
    },
  };
  const adminFetch = (async () =>
    new Response(JSON.stringify(answer), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;
  const fetched: string[] = [];
  const imageFetch = (async (input: string | URL | Request) => {
    fetched.push(String(input instanceof Request ? input.url : input));
    return new Response(new Uint8Array([7, 7]), { status: 200, headers: { "content-type": "image/png" } });
  }) as typeof fetch;
  const app = await buildApp({ dataDir, adminFetch, imageFetch, logger: false, syncOnStart: false });
  try {
    await app.inject({
      method: "PATCH",
      url: "/api/settings",
      payload: JSON.stringify({ adminUrl: "http://127.0.0.1:4747" }),
      headers: { "content-type": "application/json" },
    });

    // A channel's logo answers as a /api/images/<id> address; a source that fails the address
    // rule is left as it is (docs/03 section 3.11), and the state answer carries the same view.
    // The cache keeps the backend's order (03 section 3.4); each row is still found by its id.
    const channels = JSON.parse((await app.inject({ method: "GET", url: "/api/channels" })).body);
    const channelOf = (items: Array<{ id: string; logoUrl?: string }>, id: string) =>
      items.find((one) => one.id === id);
    assert.equal(channelOf(channels.data.items, "c1")?.logoUrl, `/api/images/${imageIdOf(good)}`);
    assert.equal(channelOf(channels.data.items, "c2")?.logoUrl, refused);
    // The backend's own cached copy wins over the playlist's logo and is stored as an absolute address.
    assert.equal(
      channelOf(channels.data.items, "c3")?.logoUrl,
      `/api/images/${imageIdOf("http://127.0.0.1:4747/logos/c/three.png")}`,
    );
    const state = JSON.parse((await app.inject({ method: "GET", url: "/api/state" })).body);
    assert.equal(channelOf(state.data.channels.items, "c1")?.logoUrl, `/api/images/${imageIdOf(good)}`);

    // The first logo request fetches from the remembered source and serves it; nothing is stored.
    const logo = await app.inject({ method: "GET", url: channelOf(channels.data.items, "c1")?.logoUrl });
    assert.equal(logo.statusCode, 200);
    assert.equal(logo.headers["content-type"], "image/png");
    assert.deepEqual(fetched, [good]);
  } finally {
    await app.close();
    rmSync(dataDir, { recursive: true, force: true });
  }
});
