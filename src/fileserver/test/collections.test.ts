import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import os from "node:os";
import path from "node:path";

import { makeApp, pick, send, type FileserverApp } from "./app-fixture.js";

const createInput = (name: unknown, type: unknown = "local") => ({ name, type });

function addFolderFile(t: FileserverApp, collectionId: string, fileId: string): void {
  const db = new DatabaseSync(path.join(t.dataDir, "giga-stream.db"));
  try {
    const folderId = crypto.randomUUID();
    const privatePath = path.join(t.dataDir, "private", folderId);
    db.prepare(
      "INSERT INTO collection_folders (id, collection_id, path, name, created_at) VALUES (?, ?, ?, ?, ?)",
    ).run(folderId, collectionId, privatePath, "private", 1);
    db.prepare(
      `INSERT INTO local_files
         (id, folder_id, collection_id, path, title, playable, added_at)
       VALUES (?, ?, ?, ?, ?, 1, ?)`,
    ).run(fileId, folderId, collectionId, path.join(privatePath, "clip.mkv"), "clip.mkv", 1);
  } finally {
    db.close();
  }
}

test("a collection is created, read, renamed and listed", async () => {
  const t = await makeApp();
  const created = await send(t.app, "POST", "/api/collections", { name: "Movies", type: "movie" });
  assert.equal(created.status, 201);
  const id = pick(created.body, "data.id") as string;
  assert.equal(pick(created.body, "data.name"), "Movies");
  assert.equal(pick(created.body, "data.type"), "movie");
  assert.equal(pick(created.body, "data.itemCount"), 0);
  assert.deepEqual(pick(created.body, "data.folders"), []);

  const retagged = await send(t.app, "PATCH", `/api/collections/${id}`, { type: "tv" });
  assert.equal(pick(retagged.body, "data.name"), "Movies");
  assert.equal(pick(retagged.body, "data.type"), "tv");

  const renamed = await send(t.app, "PATCH", `/api/collections/${id}`, { name: "  Films  ", type: "local" });
  assert.equal(pick(renamed.body, "data.name"), "Films");
  assert.equal(pick(renamed.body, "data.type"), "local");

  await send(t.app, "POST", "/api/collections", { name: "Series", type: "tv" });
  const list = await send(t.app, "GET", "/api/collections");
  const names = (pick(list.body, "data") as Array<{ name: string }>).map((one) => one.name);
  assert.deepEqual(names, ["Films", "Series"]);
  await t.dispose();
});

test("a name that is empty, too long, or a duplicate ignoring case is refused", async () => {
  const t = await makeApp();
  const made = await send(t.app, "POST", "/api/collections", createInput("Movies", "movie"));
  const id = String(pick(made.body, "data.id"));
  assert.equal((await send(t.app, "POST", "/api/collections", createInput("movies", "movie"))).status, 422);
  assert.equal(
    pick((await send(t.app, "POST", "/api/collections", createInput("movies", "movie"))).body, "error.code"),
    "collection.invalid",
  );
  assert.equal((await send(t.app, "POST", "/api/collections", createInput("   "))).status, 422);
  assert.equal((await send(t.app, "POST", "/api/collections", createInput("x".repeat(81)))).status, 422);
  assert.equal((await send(t.app, "POST", "/api/collections", createInput("Bad type", "other"))).status, 422);
  assert.equal((await send(t.app, "PATCH", `/api/collections/${id}`, { type: "other" })).status, 422);
  assert.equal((await send(t.app, "PATCH", `/api/collections/${id}`, {})).status, 422);
  await t.dispose();
});

test("collection create requires type at the route boundary", async () => {
  const t = await makeApp();
  assert.equal((await send(t.app, "POST", "/api/collections", { name: "Missing type" })).status, 400);
  await t.dispose();
});

test("manual members come and go and count, with the shape of docs/03 section 3.7", async () => {
  const t = await makeApp();
  const makeCollection = await send(t.app, "POST", "/api/collections", { name: "Watch list", type: "movie" });
  const collectionId = pick(makeCollection.body, "data.id") as string;

  const added = await send(t.app, "PUT", `/api/collections/${collectionId}/items`, {
    kind: "title",
    id: "tt1234567",
  });
  assert.equal(pick(added.body, "data.itemCount"), 1);

  // Adding one that is already there is no change.
  await send(t.app, "PUT", `/api/collections/${collectionId}/items`, { kind: "title", id: "tt1234567" });
  assert.equal(pick((await send(t.app, "GET", "/api/state")).body, "data.collections.0.itemCount"), 1);

  const memberships = await send(t.app, "GET", "/api/items/title/tt1234567/collections");
  assert.deepEqual(pick(memberships.body, "data.memberships"), [{ collectionId, source: "manual" }]);
  assert.deepEqual(
    pick((await send(t.app, "GET", "/api/items/local/unknown/collections")).body, "data.memberships"),
    [],
  );

  const removed = await send(t.app, "DELETE", `/api/collections/${collectionId}/items/title/tt1234567`);
  assert.equal(pick(removed.body, "data.itemCount"), 0);
  await t.dispose();
});

test("membership sources prefer manual and deleting it reveals a folder membership", async () => {
  const t = await makeApp();
  const alpha = await send(t.app, "POST", "/api/collections", { name: "Alpha", type: "local" });
  const beta = await send(t.app, "POST", "/api/collections", { name: "Beta", type: "local" });
  const alphaId = String(pick(alpha.body, "data.id"));
  const betaId = String(pick(beta.body, "data.id"));
  const fileId = crypto.randomUUID();
  addFolderFile(t, alphaId, fileId);
  await send(t.app, "PUT", `/api/collections/${alphaId}/items`, { kind: "local", id: fileId });
  await send(t.app, "PUT", `/api/collections/${betaId}/items`, { kind: "local", id: fileId });

  const both = await send(t.app, "GET", `/api/items/local/${fileId}/collections`);
  assert.deepEqual(both.body, {
    ok: true,
    data: {
      memberships: [
        { collectionId: alphaId, source: "manual" },
        { collectionId: betaId, source: "manual" },
      ],
    },
  });
  assert.ok(!JSON.stringify(both.body).includes(t.dataDir), "the private folder path stays in the store");

  await send(t.app, "DELETE", `/api/collections/${alphaId}/items/local/${fileId}`);
  const revealed = await send(t.app, "GET", `/api/items/local/${fileId}/collections`);
  assert.deepEqual(pick(revealed.body, "data.memberships"), [
    { collectionId: alphaId, source: "folder" },
    { collectionId: betaId, source: "manual" },
  ]);
  assert.equal(pick((await send(t.app, "GET", "/api/collections")).body, "data.0.itemCount"), 1);
  await t.dispose();
});

test("an unknown collection is 404 collection.not_found on every write route", async () => {
  const t = await makeApp();
  const ghost = "/api/collections/no-such-id";
  // Section 3.7 defines no read-one route: its read is the list, so the unknown-id rule is the writes'.
  assert.equal(pick((await send(t.app, "PATCH", ghost, { name: "x" })).body, "error.code"), "collection.not_found");
  assert.equal((await send(t.app, "PATCH", ghost, { name: "x" })).status, 404);
  assert.equal((await send(t.app, "PUT", `${ghost}/items`, { kind: "title", id: "y" })).status, 404);
  assert.equal((await send(t.app, "DELETE", ghost)).status, 404);
  assert.equal((await send(t.app, "POST", `${ghost}/folders`, { token: "z" })).status, 404);
  await t.dispose();
});

test("a delete removes the collection, and the state answer stops listing it", async () => {
  const t = await makeApp();
  const makeCollection = await send(t.app, "POST", "/api/collections", { name: "Gone", type: "local" });
  const id = pick(makeCollection.body, "data.id") as string;
  const answer = await send(t.app, "DELETE", `/api/collections/${id}`);
  assert.deepEqual(pick(answer.body, "data.removed"), id);
  // Section 3.7's read is the list: the removed collection is not in it anymore.
  const listed = await send(t.app, "GET", "/api/collections");
  assert.ok(!(pick(listed.body, "data") as Array<{ id: string }>).some((one) => one.id === id));
  assert.deepEqual(pick((await send(t.app, "GET", "/api/state")).body, "data.collections"), []);
  await t.dispose();
});

test("collection type survives a fileserver restart", async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-collection-restart-"));
  const first = await makeApp({ dataDir });
  const made = await send(first.app, "POST", "/api/collections", { name: "Series", type: "tv" });
  const id = String(pick(made.body, "data.id"));
  await first.dispose();

  const second = await makeApp({ dataDir });
  const listed = pick((await send(second.app, "GET", "/api/collections")).body, "data") as Array<{
    id: string;
    type: string;
  }>;
  assert.equal(listed.find((collection) => collection.id === id)?.type, "tv");
  await second.dispose();
  rmSync(dataDir, { recursive: true, force: true });
});
