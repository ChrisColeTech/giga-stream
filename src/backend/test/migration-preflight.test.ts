import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { runMigrationPreflight, type MigrationStoreFactory } from "../src/migration-preflight.js";

test("root dev migrates after setup and before any program starts", () => {
  const rootPackage = JSON.parse(readFileSync(path.resolve(import.meta.dirname, "../../../package.json"), "utf8")) as {
    scripts?: { dev?: unknown };
  };
  const dev = rootPackage.scripts?.dev;
  assert.equal(typeof dev, "string");
  const command = dev as string;
  const kill = command.indexOf("npm run kill-ports");
  const fixtures = command.indexOf("npm run fixtures");
  const migrate = command.indexOf("npm run migrate:dev --prefix src/backend");
  const concurrent = command.indexOf("concurrently");
  assert.ok(kill >= 0 && kill < fixtures, "kill-ports must run before fixtures");
  assert.ok(fixtures < migrate, "fixtures must run before migration preflight");
  assert.ok(migrate < concurrent, "migration preflight must finish before concurrently starts programs");
});

test("migration preflight uses the backend database path and closes after success", async () => {
  let opened = "";
  let closes = 0;
  const create: MigrationStoreFactory = async (file) => {
    opened = file;
    return { close: () => closes++ };
  };
  const reports: string[] = [];
  await runMigrationPreflight("C:/data", create, (message) => reports.push(message));
  assert.equal(opened, path.join("C:/data", "admin.db"));
  assert.equal(closes, 1);
  assert.deepEqual(reports, ["Database migrations are current."]);
});

test("migration preflight closes after a post-migration failure", async () => {
  let closes = 0;
  const create: MigrationStoreFactory = async () => ({ close: () => closes++ });
  await assert.rejects(
    runMigrationPreflight("C:/data", create, () => {
      throw new Error("report failed");
    }),
    /report failed/,
  );
  assert.equal(closes, 1);
});
