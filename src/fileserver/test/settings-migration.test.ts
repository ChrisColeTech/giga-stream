import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { migrate, readSchemaVersion } from "../src/store/migrate.js";
import { makeApp, pick, send } from "./app-fixture.js";

interface SettingRow {
  key: string;
  value: string;
  updated_at: number;
}

function versionSeven(rows: SettingRow[]): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL)");
  const insert = db.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)");
  for (const row of rows) insert.run(row.key, row.value, row.updated_at);
  db.exec("PRAGMA user_version = 7");
  return db;
}

function settingsRows(db: DatabaseSync): SettingRow[] {
  return db.prepare("SELECT key, value, updated_at FROM settings ORDER BY key").all().map((row) => ({
    key: String(row.key),
    value: String(row.value),
    updated_at: Number(row.updated_at),
  }));
}

test("migration 008 maps legacy theme and motion while preserving unrelated rows and timestamps", () => {
  const db = versionSeven([
    { key: "theme", value: '"system"', updated_at: 11 },
    { key: "reducedMotion", value: '"system"', updated_at: 12 },
    { key: "uiZoom", value: "1.5", updated_at: 13 },
    { key: "futureSetting", value: '{"keep":true}', updated_at: 14 },
  ]);

  assert.equal(migrate(db), 8);
  assert.equal(readSchemaVersion(db), 8);
  assert.deepEqual(settingsRows(db), [
    { key: "futureSetting", value: '{"keep":true}', updated_at: 14 },
    { key: "reducedMotion", value: '"off"', updated_at: 12 },
    { key: "theme", value: '"dark"', updated_at: 11 },
    { key: "uiZoom", value: "1.5", updated_at: 13 },
  ]);
  db.close();
});

test("migration 008 leaves current theme and motion rows unchanged", () => {
  const before: SettingRow[] = [
    { key: "theme", value: '"light"', updated_at: 21 },
    { key: "reducedMotion", value: '"on"', updated_at: 22 },
  ];
  const db = versionSeven(before);

  assert.equal(migrate(db), 8);
  assert.deepEqual(settingsRows(db), [...before].sort((a, b) => a.key.localeCompare(b.key)));
  db.close();
});

test("current settings refuse system and fresh defaults are dark with motion off", async () => {
  const app = await makeApp();
  for (const key of ["theme", "reducedMotion"]) {
    const answer = await send(app.app, "PATCH", "/api/settings", { [key]: "system" });
    assert.equal(answer.status, 422, key);
    assert.equal(pick(answer.body, "error.code"), "settings.invalid", key);
  }
  const settings = await send(app.app, "GET", "/api/settings");
  assert.equal(pick(settings.body, "data.theme"), "dark");
  assert.equal(pick(settings.body, "data.reducedMotion"), "off");
  await app.dispose();
});
