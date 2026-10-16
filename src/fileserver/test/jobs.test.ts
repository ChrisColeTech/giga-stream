import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const folderRoot = mkdtempSync(path.join(os.tmpdir(), "giga-jobs-root-"));
process.env.TEST_FOLDER_ROOT = folderRoot;
const { makeApp, pick, send } = await import("./app-fixture.js");

type AppRef = Awaited<ReturnType<typeof makeApp>>;
const SETTLED = new Set(["done", "failed", "cancelled", "interrupted"]);

function makeFolder(name: string): void {
  const folder = path.join(folderRoot, name);
  mkdirSync(folder, { recursive: true });
  writeFileSync(path.join(folder, "one.mp4"), "bytes");
}

function jobsOf(answer: { body: unknown }): Array<{ id: string; kind: string; state: string; label: string; error?: { code: string } }> {
  assert.ok(Array.isArray(pick(answer.body, "data")));
  return pick(answer.body, "data") as never;
}

/** Waits for one job by id; the runner turns between ticks, nothing sleeps. */
async function settled(t: AppRef, jobId: string): Promise<void> {
  for (let attempt = 0; attempt < 500; attempt++) {
    if (!jobsOf(await send(t.app, "GET", "/api/jobs")).some((job) => job.id === jobId && !SETTLED.has(job.state))) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.fail("the job never settled");
}

/** Queues one scan by attaching a folder and answers that job's id (the queue's newest row). */
async function queuedScanJob(t: AppRef): Promise<string> {
  makeFolder("JobsLane");
  const chooser = await send(t.app, "POST", "/api/fs/dialog", { name: "JobsLane" });
  const makeCollection = await send(t.app, "POST", "/api/collections", { name: "Races" });
  await send(t.app, "POST", `/api/collections/${pick(makeCollection.body, "data.id")}/folders`, {
    token: pick(chooser.body, "data.token"),
  });
  for (let attempt = 0; attempt < 200; attempt++) {
    const scan = jobsOf(await send(t.app, "GET", "/api/jobs")).find((job) => job.kind === "folder-scan");
    if (scan !== undefined) return scan.id;
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.fail("no scan ever queued");
}

test("a job row answers with the shape of docs/03 section 3.9 and never a path", async () => {
  const t = await makeApp();
  const jobId = await queuedScanJob(t);
  await settled(t, jobId);
  const job = jobsOf(await send(t.app, "GET", "/api/jobs")).find((one) => one.id === jobId);
  assert.equal(job?.kind, "folder-scan");
  assert.equal(job?.label, "Scanning JobsLane");
  assert.equal(job?.state, "done");
  assert.ok(!String(job?.label).includes("\\")); // a Windows path would show a backslash anywhere
  await t.dispose();
});

test("a settled job is dismissable and an unknown one is 404 job.not_found", async () => {
  const t = await makeApp();
  const jobId = await queuedScanJob(t);
  await settled(t, jobId);
  const gone = await send(t.app, "DELETE", `/api/jobs/${jobId}`);
  assert.deepEqual(pick(gone.body, "data.removed"), jobId);
  assert.equal(pick(await send(t.app, "DELETE", `/api/jobs/${jobId}`), "error.code"), "job.not_found");
  assert.equal(pick(await send(t.app, "POST", "/api/jobs/ghost/cancel"), "error.code"), "job.not_found");
  await t.dispose();
});

test("a restart marks every job left behind as interrupted, with none resumed", async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-jobs-restart-"));
  const first = await makeApp({ dataDir });
  const at = Date.UTC(2026, 9, 16, 12);
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(path.join(dataDir, "giga-stream.db"));
  db.prepare("INSERT INTO jobs (id, kind, label, state, request, created_at) VALUES (?, ?, ?, ?, ?, ?)").run("job-queued", "folder-scan", "Scanning LeftLane", "queued", JSON.stringify({ folderId: "any" }), at);
  db.prepare("INSERT INTO jobs (id, kind, label, state, request, created_at) VALUES (?, ?, ?, ?, ?, ?)").run("job-running", "poster-fetch", "Capturing a still of one", "running", "null", at);
  db.prepare("INSERT INTO jobs (id, kind, label, state, request, created_at) VALUES (?, ?, ?, ?, ?, ?)").run("job-cancelling", "media-probe", "Probing one", "cancelling", "null", at);
  db.prepare("INSERT INTO jobs (id, kind, label, state, request, created_at, finished_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run("job-done", "folder-scan", "Old scan", "done", "null", at, at);
  db.close();
  await first.dispose();

  const second = await makeApp({ dataDir });
  const states = new Map(jobsOf(await send(second.app, "GET", "/api/jobs")).map((job) => [job.id, job]));
  assert.equal(states.get("job-queued")?.state, "interrupted");
  assert.equal(states.get("job-running")?.state, "interrupted");
  assert.equal(states.get("job-cancelling")?.state, "interrupted");
  assert.equal(states.get("job-done")?.state, "done");
  assert.equal(states.get("job-queued")?.error?.code, "job.interrupted");
  await second.dispose();
  rmSync(dataDir, { recursive: true, force: true });
});

after(async () => {
  rmSync(folderRoot, { recursive: true, force: true });
});
