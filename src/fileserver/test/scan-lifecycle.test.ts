import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import Fastify from "fastify";

import { createJobService, type JobService } from "../src/services/job-service.js";
import { streamScan } from "../src/routes/folders.js";
import { createCollectionService, type CollectionService } from "../src/services/collection-service.js";
import { createScanService, type ScanService, type ScanStream } from "../src/services/scan-service.js";
import { createCollectionRepository, type CollectionRepository } from "../src/store/collection-repository.js";
import { openDatabase, type Database } from "../src/store/database.js";
import { createJobRepository } from "../src/store/job-repository.js";
import { createLocalFileRepository } from "../src/store/local-file-repository.js";
import type { PublicScanEvent } from "../src/types/scan-event.js";
import { fakeScan } from "./fake-scan.js";

interface Rig {
  db: Database;
  jobs: JobService;
  scans: ScanService;
  collections: CollectionService;
  folders: CollectionRepository;
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
    scan: fakeScan,
  });
  const collections = createCollectionService({
    collections: folders,
    scans,
    dialog: {
      selectFolder: async () => ({ token: "unused", name: "unused" }),
      redeem: async () => root,
    },
    now: () => 1,
  });
  jobs.register("folder-scan", scans.runner);
  return {
    db,
    jobs,
    scans,
    collections,
    folders,
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
  const disconnectedEvents: PublicScanEvent[] = [];
  const disconnect = queued.subscribe((event) => disconnectedEvents.push(event), () => undefined);
  disconnect();
  queued.subscribe((event) => {
    firstEvents.push(event);
    if (event.type === "found" && !lateAttached) {
      lateAttached = true;
      const late = rig.scans.readStream("folder-1");
      assert.ok(late !== undefined);
      lateSnapshot = late.snapshot;
      late.subscribe((next) => lateEvents.push(next), () => undefined);
    }
  }, () => undefined);
  await waitForSettled(rig.jobs, firstJob.id);
  assert.equal(rig.jobs.get(firstJob.id).state, "done");
  assert.deepEqual(disconnectedEvents, []);
  assert.ok(firstEvents.some((event) => event.type === "found"));
  assert.equal(lateSnapshot.filter((event) => event.type === "found").length, 1);
  assert.equal(lateEvents.some((event) => event.type === "found"), false);
  assert.ok(lateEvents.some((event) => event.type === "done"));
  const done = rig.scans.readStream("folder-1")?.snapshot.at(-1);
  assert.deepEqual(done, { type: "done", found: 1, probed: 1, unplayable: 1 });
  assert.ok(done !== undefined && !("files" in done));

  rig.scans.queueScan("folder-1");
  const replacement = rig.jobs.list().find((job) => job.id !== firstJob.id && job.kind === "folder-scan");
  assert.ok(replacement !== undefined);
  assert.deepEqual(rig.scans.readStream("folder-1")?.snapshot, []);
  await waitForSettled(rig.jobs, replacement.id);
  rig.jobs.dismiss(replacement.id);
  assert.equal(rig.scans.readStream("folder-1"), undefined);

  rig.scans.queueScan("folder-1");
  const third = rig.jobs.list().find((job) => ![firstJob.id, replacement.id].includes(job.id));
  assert.ok(third !== undefined);
  await waitForSettled(rig.jobs, third.id);
  rig.collections.detachFolder("folder-1");
  rig.folders.addFolder("folder-1", "collection-1", rig.root, "Local", 2);
  assert.equal(rig.scans.readStream("folder-1"), undefined);

  rig.scans.queueScan("folder-1");
  const fourth = rig.jobs.list().find((job) => ![firstJob.id, replacement.id, third.id].includes(job.id));
  assert.ok(fourth !== undefined);
  await waitForSettled(rig.jobs, fourth.id);
  rig.collections.remove("collection-1");
  rig.folders.insertCollection("collection-1", "Local again", "local", 3);
  rig.folders.addFolder("folder-1", "collection-1", rig.root, "Local", 3);
  assert.equal(rig.scans.readStream("folder-1"), undefined);
  await rig.close();
});

test("a failed scan ends active readers, exposes the failed job, and retains no terminal stream", async () => {
  const rig = makeRig();
  rmSync(rig.root, { recursive: true, force: true });
  rig.scans.queueScan("folder-1");
  const job = rig.jobs.list().find((one) => one.kind === "folder-scan");
  assert.ok(job !== undefined);
  let ended = false;
  rig.scans.readStream("folder-1")?.subscribe(() => undefined, () => {
    ended = true;
  });
  await waitForSettled(rig.jobs, job.id);
  assert.equal(ended, true);
  assert.equal(rig.jobs.get(job.id).state, "failed");
  assert.equal(rig.jobs.get(job.id).error?.code, "internal.failure");
  assert.equal(rig.scans.readStream("folder-1"), undefined);
  await rig.close();
});

test("an HTTP response disconnect unsubscribes only its stream reader", async () => {
  const app = Fastify({ logger: false });
  let unsubscribed = false;
  const stream: ScanStream = {
    snapshot: [],
    subscribe(onEvent) {
      queueMicrotask(() => onEvent({ type: "progress", found: 1, probed: 0, total: null }));
      return () => {
        unsubscribed = true;
      };
    },
  };
  app.get("/scan", async (_request, reply) => {
    reply.hijack();
    streamScan(stream, reply.raw);
  });
  const address = await app.listen({ host: "127.0.0.1", port: 0 });
  await new Promise<void>((resolve, reject) => {
    const request = http.get(`${address}/scan`, (response) => {
      response.once("data", () => {
        response.destroy();
        resolve();
      });
    });
    request.once("error", reject);
  });
  for (let attempt = 0; attempt < 20 && !unsubscribed; attempt++) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.equal(unsubscribed, true);
  await app.close();
});
