import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createJobService, type JobService } from "../src/services/job-service.js";
import { createScanService, type ScanService } from "../src/services/scan-service.js";
import { createCollectionRepository } from "../src/store/collection-repository.js";
import { openDatabase, type Database } from "../src/store/database.js";
import { createJobRepository } from "../src/store/job-repository.js";
import { createLocalFileRepository } from "../src/store/local-file-repository.js";
import type { PublicScanEvent } from "../src/types/scan-event.js";

interface Rig {
  db: Database;
  jobs: JobService;
  scans: ScanService;
  root: string;
  close: () => Promise<void>;
}

function makeRig(files: string[] = []): Rig {
  const root = mkdtempSync(path.join(os.tmpdir(), "giga-scan-life-"));
  for (const file of files) writeFileSync(path.join(root, file), "bytes");
  const db = openDatabase(":memory:");
  const folders = createCollectionRepository(db);
  folders.insertCollection("collection-1", "Local", "local", 0);
  folders.addFolder("folder-1", "collection-1", root, "Local", 0);
  const jobs = createJobService({ repository: createJobRepository(db), now: () => 1 });
  const scans = createScanService({
    jobs,
    folders,
    files: createLocalFileRepository(db),
    posters: { queue: () => undefined, runner: async () => undefined },
    now: () => 1,
  });
  jobs.register("folder-scan", scans.runner);
  return {
    db,
    jobs,
    scans,
    root,
    async close() {
      await jobs.close();
      db.close();
      rmSync(root, { recursive: true, force: true });
    },
  };
}

async function waitForSettled(jobs: JobService, jobId: string): Promise<void> {
  for (let attempt = 0; attempt < 500; attempt++) {
    const state = jobs.get(jobId).state;
    if (["done", "failed", "cancelled", "interrupted"].includes(state)) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.fail("job did not settle");
}

test("a queued scan has a channel and queued cancellation is retained as terminal catch-up", async () => {
  const rig = makeRig();
  let release: () => void = () => undefined;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  rig.jobs.register("poster-fetch", async () => hold);
  rig.jobs.enqueue("poster-fetch", "Blocking one", { localFileId: "one" });
  rig.jobs.enqueue("poster-fetch", "Blocking two", { localFileId: "two" });
  rig.scans.queueScan("folder-1");

  const queued = rig.scans.readStream("folder-1");
  assert.ok(queued !== undefined);
  assert.deepEqual(queued.snapshot, []);
  const scan = rig.jobs.list().find((job) => job.kind === "folder-scan");
  assert.ok(scan !== undefined);
  assert.equal(scan.folderId, "folder-1");
  assert.equal(rig.jobs.cancel(scan.id).folderId, "folder-1");
  await waitForSettled(rig.jobs, scan.id);
  assert.equal(rig.scans.readStream("folder-1")?.snapshot.at(-1)?.type, "cancelled");
  release();
  await rig.close();
});

test("active readers get catch-up and live lines; disconnect does not cancel; terminal channels replace and dismiss", async () => {
  const rig = makeRig(["one.mp4"]);
  rig.scans.queueScan("folder-1");
  const firstJob = rig.jobs.list().find((job) => job.kind === "folder-scan");
  assert.ok(firstJob !== undefined);
  const firstEvents: PublicScanEvent[] = [];
  const lateEvents: PublicScanEvent[] = [];
  let lateSnapshot: readonly PublicScanEvent[] = [];
  let lateAttached = false;
  const queued = rig.scans.readStream("folder-1");
  assert.ok(queued !== undefined);
  const disconnect = queued.subscribe((event) => {
    firstEvents.push(event);
    if (event.type === "found" && !lateAttached) {
      lateAttached = true;
      const late = rig.scans.readStream("folder-1");
      assert.ok(late !== undefined);
      lateSnapshot = late.snapshot;
      late.subscribe((next) => lateEvents.push(next), () => undefined);
    }
  }, () => undefined);
  disconnect();
  const durable = rig.scans.readStream("folder-1");
  assert.ok(durable !== undefined);
  durable.subscribe((event) => firstEvents.push(event), () => undefined);
  await waitForSettled(rig.jobs, firstJob.id);
  assert.equal(rig.jobs.get(firstJob.id).state, "done");
  assert.ok(lateSnapshot.some((event) => event.type === "found"));
  assert.ok(lateEvents.some((event) => event.type === "done"));
  assert.equal(rig.scans.readStream("folder-1")?.snapshot.at(-1)?.type, "done");

  rig.scans.queueScan("folder-1");
  const replacement = rig.jobs.list().find((job) => job.id !== firstJob.id && job.kind === "folder-scan");
  assert.ok(replacement !== undefined);
  assert.deepEqual(rig.scans.readStream("folder-1")?.snapshot, []);
  await waitForSettled(rig.jobs, replacement.id);
  rig.jobs.dismiss(replacement.id);
  assert.equal(rig.scans.readStream("folder-1"), undefined);
  await rig.close();
});
