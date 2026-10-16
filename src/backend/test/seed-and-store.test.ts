import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { buildApp } from "../src/app.js";
import { JWT_SECRET, makeApp, pick, send } from "./test-app.js";

test("the seed creates the four test channels on the streaming test server, once", async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-backend-seed-"));
  try {
    const first = await makeApp({ seed: true, dataDir });
    const list = (await send(first.app, "GET", "/api/channels")).body;
    const items = pick(list, "data.items") as Array<Record<string, unknown>>;
    assert.deepEqual(items.map((c) => [c.id, c.name, c.number, c.category]), [
      ["fx-news", "Fixture News", "1", "News"],
      ["fx-sports", "Fixture Sports", "2", "Sports"],
      ["fx-music", "Fixture Music", "3", "Music"],
      ["fx-kids", "Fixture Kids", "4", "Kids"],
    ]);
    assert.equal(items[0]?.streamUrl, "http://127.0.0.1:8097/live/fx-news/master.m3u8");
    assert.equal(items[0]?.logoUrl, "http://127.0.0.1:8097/logos/fx-news.png");
    assert.equal(pick(list, "data.revision"), 4);
    await first.dispose();

    // A backend that already has channels is not seeded again.
    const second = await makeApp({ seed: true, dataDir });
    assert.equal(pick((await send(second.app, "GET", "/api/channels")).body, "data.revision"), 4);
    await second.dispose();
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("the seed without the loopback flag refuses to start before creating any database file", async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-backend-refuse-"));
  try {
    await assert.rejects(
      buildApp({ NODE_ENV: "test", HOST: "127.0.0.1", DATA_DIR: dataDir, JWT_SECRET, SEED_TEST_CHANNELS: true, ALLOW_LOOPBACK_STREAMS: false }),
      /ALLOW_LOOPBACK_STREAMS/,
    );
    assert.deepEqual(readdirSync(dataDir), []);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("channels and the revision survive a restart", async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-backend-restart-"));
  try {
    const first = await makeApp({ seed: true, dataDir });
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
