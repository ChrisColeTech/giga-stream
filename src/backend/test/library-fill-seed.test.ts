// The first-start seed of the Library fill (docs/26 section 3.11, docs/44 section 3.4): the job starts Enabled whatever
// the environment says (the schedule is TMDB_SYNC_SCHEDULE or `off`), and an admin's later choice is never re-seeded.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { itemsOf } from "./live-channel-kit.js";
import { makeApp, send, signIn } from "./test-app.js";

const FILL = { scope: "discover", pages: 500 };

async function jobsOf(t: Awaited<ReturnType<typeof makeApp>>): Promise<Array<Record<string, unknown>>> {
  const token = (await signIn(t.app)).access;
  return itemsOf((await send(t.app, "GET", "/api/jobs", undefined, token)).body);
}

test("a fresh database with no TMDB_SYNC_SCHEDULE seeds the Library fill enabled, with the schedule off", async () => {
  const t = await makeApp();
  const jobs = await jobsOf(t);
  assert.deepEqual(jobs.map((j) => [j.name, j.type, j.enabled, j.schedule, j.config]), [
    ["Library fill", "catalog", true, "off", FILL],
  ]);
});

test("a fresh database with TMDB_SYNC_SCHEDULE seeds it enabled on that schedule", async () => {
  const jobs = await jobsOf(await makeApp({ config: { TMDB_SYNC_SCHEDULE: "24h" } }));
  assert.deepEqual(jobs.map((j) => [j.enabled, j.schedule]), [[true, "24h"]]);
});

test("an admin who disabled the Library fill finds it disabled after a restart, whatever the environment says", async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-backend-fill-seed-"));
  try {
    const first = await makeApp({ dataDir });
    const token = (await signIn(first.app)).access;
    const id = (await jobsOf(first))[0]?.id;
    const off = await send(first.app, "PATCH", `/api/jobs/${id}`, { enabled: false, schedule: "12h" }, token);
    assert.equal(off.status, 200);
    await first.dispose();
    const second = await makeApp({ dataDir, config: { TMDB_SYNC_SCHEDULE: "2h" } });
    assert.deepEqual((await jobsOf(second)).map((j) => [j.id, j.enabled, j.schedule]), [[id, false, "12h"]]);
    await second.dispose();
  } finally {
    try {
      rmSync(dataDir, { recursive: true, force: true });
    } catch {
      // Windows can hold the SQLite file open briefly after dispose; the temp dir is cleaned up on reboot.
    }
  }
});
