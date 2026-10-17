import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { buildApp } from "../src/app.js";
import { itemOf, itemsOf } from "./live-channel-kit.js";
import { JWT_SECRET, makeApp, pick, send, signIn } from "./test-app.js";

/** The fixture files the seed looks for (docs/10 section 2.1), as empty placeholders: the fake build never reads them. */
function placeholderFixtures(dataDir: string): string {
  const fixtures = path.join(dataDir, "fixtures");
  mkdirSync(path.join(fixtures, "live"), { recursive: true });
  for (const kind of ["news", "sports", "music", "kids"]) {
    for (const n of [1, 2, 3]) writeFileSync(path.join(fixtures, "live", `${kind}-${n}.mp4`), "");
  }
  return fixtures;
}

test("the seed creates the four test channels as live rows served by this backend, once, with no loopback flag", async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-backend-seed-"));
  try {
    const fixtures = placeholderFixtures(dataDir);
    const first = await makeApp({ seed: true, dataDir, config: { FIXTURE_DIR: fixtures, ALLOW_LOOPBACK_STREAMS: false } });
    const list = (await send(first.app, "GET", "/api/channels")).body;
    assert.deepEqual(itemsOf(list).map((c) => [c.id, c.name, c.number, c.category, c.kind]), [
      ["fx-news", "Fixture News", "1", "News", "live"],
      ["fx-sports", "Fixture Sports", "2", "Sports", "live"],
      ["fx-music", "Fixture Music", "3", "Music", "live"],
      ["fx-kids", "Fixture Kids", "4", "Kids", "live"],
    ]);
    assert.equal(itemOf(list, "fx-news").streamUrl, "http://localhost:80/live/fx-news/master.m3u8");
    assert.equal(itemOf(list, "fx-news").logoUrl, "http://localhost:80/logos/fx-news.png");
    assert.equal(pick(list, "data.revision"), 4);
    await first.live.settled();
    const admin = (await send(first.app, "GET", "/api/admin-channels", undefined, (await signIn(first.app)).access)).body;
    assert.deepEqual(itemsOf(admin).map((c) => [c.id, c.state, c.captions, (c.variants as string[]).length, (c.videos as string[]).length]), [
      ["fx-news", "live", true, 2, 3],
      ["fx-sports", "live", false, 3, 3],
      ["fx-music", "live", false, 2, 3],
      ["fx-kids", "live", false, 2, 3],
    ]);
    assert.equal(pick((await send(first.app, "GET", "/healthz")).body, "data.liveChannels"), 4);
    await first.dispose();

    // A backend that already has channels is not seeded again.
    const second = await makeApp({ seed: true, dataDir, config: { FIXTURE_DIR: fixtures } });
    assert.equal(pick((await send(second.app, "GET", "/api/channels")).body, "data.revision"), 4);
    await second.dispose();
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("the seed without the fixture files refuses to start, naming the command that makes them", async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-backend-refuse-"));
  try {
    await assert.rejects(
      buildApp({
        NODE_ENV: "test",
        HOST: "127.0.0.1",
        DATA_DIR: dataDir,
        CACHE_DIR: path.join(dataDir, "cache"),
        FIXTURE_DIR: path.join(dataDir, "no-fixtures"),
        JWT_SECRET,
        SEED_TEST_CHANNELS: true,
      }),
      /npm run fixtures/,
    );
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("channels and the revision survive a restart", async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-backend-restart-"));
  try {
    const fixtures = placeholderFixtures(dataDir);
    const first = await makeApp({ seed: true, dataDir, config: { FIXTURE_DIR: fixtures } });
    await first.dispose();
    assert.ok(existsSync(path.join(dataDir, "admin.db")));
    const second = await makeApp({ dataDir });
    const list = (await send(second.app, "GET", "/api/channels")).body;
    assert.equal(pick(list, "data.items.length"), 4);
    assert.equal(pick(list, "data.revision"), 4);
    await second.dispose();
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("a database from a newer version is refused", async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-backend-newer-"));
  try {
    const db = new DatabaseSync(path.join(dataDir, "admin.db"));
    db.exec("PRAGMA user_version = 99");
    db.close();
    await assert.rejects(buildApp({ NODE_ENV: "test", HOST: "127.0.0.1", DATA_DIR: dataDir, JWT_SECRET }), /newer version/);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});
