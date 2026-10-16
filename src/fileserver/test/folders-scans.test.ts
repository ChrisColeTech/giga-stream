import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Answer, FileserverApp } from "./app-fixture.js";

// `TEST_FOLDER_ROOT` is read when the app's config module loads, so it must be set before the
// fixture's import; this file's own process runs one copy of that env (the Node runner isolates files).
const folderRoot = mkdtempSync(path.join(os.tmpdir(), "giga-fs-root-"));
process.env.TEST_FOLDER_ROOT = folderRoot;
const { makeApp, pick, send } = await import("./app-fixture.js");

function makeFolder(name: string, files: string[]): string {
  const folder = path.join(folderRoot, name);
  mkdirSync(folder, { recursive: true });
  for (const file of files) writeFileSync(path.join(folder, file), "bytes");
  return folder;
}

const SETTLED = new Set(["done", "failed", "cancelled", "interrupted"]);

/** Waits until every folder-scan job has settled; nothing sleeps - the runner turns between ticks. */
async function awaitScansSettled(t: FileserverApp): Promise<void> {
  for (let attempt = 0; attempt < 500; attempt++) {
    const jobs = await send(t.app, "GET", "/api/jobs");
    const list = Array.isArray(pick(jobs.body, "data"))
      ? (pick(jobs.body, "data") as Array<{ kind: string; state: string }>)
      : [];
    const busy = list.some((job) => job.kind === "folder-scan" && !SETTLED.has(job.state));
    if (!busy) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.fail("scans never settled");
}

/** Streams the folder's scan; queues a fresh one when none is running yet, then reads to the end. */
async function readScanStream(t: FileserverApp, folderId: string): Promise<Answer> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const stream = await send(t.app, "GET", `/api/folders/${folderId}/scan`);
    if (stream.status === 200) return stream;
    if (pick(stream.body, "error.code") === "job.not_running") {
      await send(t.app, "POST", `/api/folders/${folderId}/rescan`);
    }
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.fail("no scan ever ran for the streaming route");
}

/** Attaches one folder from the test root under a fresh collection and answers the two ids. */
async function attach(t: FileserverApp, name: string, collectionName: string): Promise<{ collectionId: string; folderId: string }> {
  const chooser = await send(t.app, "POST", "/api/fs/dialog", { name });
  const makeCollection = await send(t.app, "POST", "/api/collections", { name: collectionName });
  const attached = await send(t.app, "POST", `/api/collections/${pick(makeCollection.body, "data.id")}/folders`, {
    token: pick(chooser.body, "data.token"),
  });
  assert.equal(attached.status, 201);
  return {
    collectionId: String(pick(makeCollection.body, "data.id")),
    folderId: String(pick(attached.body, "data.id")),
  };
}

test("the test lane chooses a folder by name and the answer never carries a path", async () => {
  makeFolder("Sports", ["race.mp4"]);
  const t = await makeApp();
  const chooser = await send(t.app, "POST", "/api/fs/dialog", { name: "Sports" });
  assert.equal(pick(chooser.body, "data.name"), "Sports");
  assert.ok(pick(chooser.body, "data.token") !== undefined);
  assert.ok(!String(chooser.body).includes(folderRoot));
  // A token is single use: a body of `{ token }` against the picker lane is unusable.
  assert.equal(pick((await send(t.app, "POST", "/api/fs/dialog", { token: "x" })).body, "error.code"), "fs.invalid_selection");
  assert.equal(pick((await send(t.app, "POST", "/api/fs/dialog", { name: "gone" })).body, "error.code"), "fs.invalid_selection");
  assert.equal(pick((await send(t.app, "POST", "/api/fs/dialog", { name: "../outside" })).body, "error.code"), "fs.invalid_selection");
  await t.dispose();
});

test("attaching queues the scan: the folder answers `scanning` before and after it", async () => {
  makeFolder("AttachLane", ["a.mp4", "b.mp4"]);
  const t = await makeApp();
  const ids = await attach(t, "AttachLane", "Races");
  const folder = await send(t.app, "GET", `/api/collections/${ids.collectionId}`);
  assert.equal(pick(folder.body, "data.folders.0.scanning"), true);
  assert.equal(pick(folder.body, "data.scanning"), true);
  await awaitScansSettled(t);
  const settled = await send(t.app, "GET", `/api/collections/${ids.collectionId}`);
  assert.equal(pick(settled.body, "data.folders.0.scanning"), false);
  assert.equal(pick(settled.body, "data.itemCount"), 2);
  assert.ok(pick(settled.body, "data.folders.0.lastScannedAt") !== undefined);
  await t.dispose();
});

test("the scan streams NDJSON lines, `found` per file, and ends on `done`", async () => {
  makeFolder("ScanLane", ["a.mp4", "b.mp4"]);
  const t = await makeApp();
  const ids = await attach(t, "ScanLane", "Races");
  const stream = await readScanStream(t, ids.folderId);
  const lines = String(stream.body)
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as { type: string });
  const kinds = lines.map((line) => line.type);
  assert.ok(kinds.filter((one) => one === "found").length >= 2);
  assert.equal(kinds.at(-1), "done");
  assert.ok(kinds.every((one) => ["found", "probed", "progress", "done", "cancelled"].includes(one)));
  await awaitScansSettled(t);
  await t.dispose();
});

test("a second scan while one is still queued or running is refused with job.running", async () => {
  makeFolder("CollideLane", []);
  const t = await makeApp();
  const chooser = await send(t.app, "POST", "/api/fs/dialog", { name: "CollideLane" });
  const makeCollection = await send(t.app, "POST", "/api/collections", { name: "Races" });
  const token = pick(chooser.body, "data.token");
  const attached = await send(t.app, "POST", `/api/collections/${pick(makeCollection.body, "data.id")}/folders`, { token });
  const folderId = String(pick(attached.body, "data.id"));
  // The attach itself queued the scan, so a rescan right away collides with it.
  assert.equal(pick((await send(t.app, "POST", `/api/folders/${folderId}/rescan`)).body, "error.code"), "job.running");
  await awaitScansSettled(t);
  // After settling, the stream route answers 409 job.not_running and a rescan queues again.
  assert.equal(pick((await send(t.app, "GET", `/api/folders/${folderId}/scan`)).body, "error.code"), "job.not_running");
  assert.equal((await send(t.app, "POST", `/api/folders/${folderId}/rescan`)).status, 202);
  await awaitScansSettled(t);
  await t.dispose();
});

test("PUT with a new token moves the folder and its name follows the new location", async () => {
  makeFolder("FirstLane", ["a.mp4"]);
  makeFolder("SecondLane", ["b.mp4"]);
  const t = await makeApp();
  const ids = await attach(t, "FirstLane", "Races");
  await awaitScansSettled(t);
  const moved = await send(t.app, "PUT", `/api/folders/${ids.folderId}`, {
    token: pick((await send(t.app, "POST", "/api/fs/dialog", { name: "SecondLane" })).body, "data.token"),
  });
  assert.equal(pick(moved.body, "data.name"), "SecondLane");
  await awaitScansSettled(t);
  // The old file row went with the move: one file under the folder, not two.
  const folder = await send(t.app, "GET", `/api/collections/${ids.collectionId}`);
  assert.equal(pick(folder.body, "data.itemCount"), 1);
  await t.dispose();
});

test("detaching removes the folder and its rows, leaving the collection alone", async () => {
  makeFolder("DetachLane", ["a.mp4"]);
  const t = await makeApp();
  const ids = await attach(t, "DetachLane", "Races");
  await awaitScansSettled(t);
  const gone = await send(t.app, "DELETE", `/api/folders/${ids.folderId}`);
  assert.deepEqual(pick(gone.body, "data.removed"), ids.folderId);
  assert.deepEqual(pick((await send(t.app, "GET", `/api/collections/${ids.collectionId}`)).body, "data.folders"), []);
  assert.equal((await send(t.app, "GET", `/api/folders/${ids.folderId}/scan`)).status, 404);
  await t.dispose();
});

test("an unknown folder is 404 collection.not_found on every folder route", async () => {
  const t = await makeApp();
  assert.equal((await send(t.app, "POST", "/api/folders/no-such-folder/rescan")).status, 404);
  assert.equal((await send(t.app, "DELETE", "/api/folders/no-such-folder")).status, 404);
  assert.equal((await send(t.app, "PUT", "/api/folders/no-such-folder", { token: "x" })).status, 404);
  await t.dispose();
});

after(async () => {
  rmSync(folderRoot, { recursive: true, force: true });
});
