import test from "node:test";
import assert from "node:assert/strict";

import { makeApp, pick, send } from "./app-fixture.js";

test("a collection is created, read, renamed and listed", async () => {
  const t = await makeApp();
  const created = await send(t.app, "POST", "/api/collections", { name: "Movies" });
  assert.equal(created.status, 201);
  const id = pick(created.body, "data.id") as string;
  assert.equal(pick(created.body, "data.name"), "Movies");
  assert.equal(pick(created.body, "data.itemCount"), 0);
  assert.deepEqual(pick(created.body, "data.folders"), []);

  const renamed = await send(t.app, "PATCH", `/api/collections/${id}`, { name: "  Films  " });
  assert.equal(pick(renamed.body, "data.name"), "Films");

  await send(t.app, "POST", "/api/collections", { name: "Series" });
  const list = await send(t.app, "GET", "/api/collections");
  const names = (pick(list.body, "data") as Array<{ name: string }>).map((one) => one.name);
  assert.deepEqual(names, ["Films", "Series"]);
  await t.dispose();
});

test("a name that is empty, too long, or a duplicate ignoring case is refused", async () => {
  const t = await makeApp();
  await send(t.app, "POST", "/api/collections", { name: "Movies" });
  assert.equal((await send(t.app, "POST", "/api/collections", { name: "movies" })).status, 422);
  assert.equal(pick(await send(t.app, "POST", "/api/collections", { name: "movies" }), "error.code"), "collection.invalid");
  assert.equal((await send(t.app, "POST", "/api/collections", { name: "   " })).status, 422);
  assert.equal((await send(t.app, "POST", "/api/collections", { name: "x".repeat(81) })).status, 422);
  await t.dispose();
});

test("manual members come and go and count, with the shape of docs/03 section 3.7", async () => {
  const t = await makeApp();
  const makeCollection = await send(t.app, "POST", "/api/collections", { name: "Watch list" });
  const collectionId = pick(makeCollection.body, "data.id") as string;

  const added = await send(t.app, "PUT", `/api/collections/${collectionId}/items`, {
    kind: "title",
    id: "tt1234567",
  });
  assert.equal(pick(added.body, "data.itemCount"), 1);

  // Adding one that is already there is no change.
  await send(t.app, "PUT", `/api/collections/${collectionId}/items`, { kind: "title", id: "tt1234567" });
  assert.equal(pick(await send(t.app, "GET", "/api/state"), "data.collections.0.itemCount"), 1);

  const memberships = await send(t.app, "GET", "/api/items/title/tt1234567/collections");
  assert.deepEqual(pick(memberships.body, "data.collectionIds"), [collectionId]);
  assert.deepEqual(pick(await send(t.app, "GET", "/api/items/local/unknown/collections"), "data.collectionIds"), []);

  const removed = await send(t.app, "DELETE", `/api/collections/${collectionId}/items/title/tt1234567`);
  assert.equal(pick(removed.body, "data.itemCount"), 0);
  await t.dispose();
});

test("an unknown collection is 404 collection.not_found, everywhere", async () => {
  const t = await makeApp();
  const ghost = "/api/collections/no-such-id";
  assert.equal(pick(await send(t.app, "GET", ghost), "error.code"), "collection.not_found");
  assert.equal((await send(t.app, "PATCH", ghost, { name: "x" })).status, 404);
  assert.equal((await send(t.app, "PUT", `${ghost}/items`, { kind: "title", id: "y" })).status, 404);
  assert.equal((await send(t.app, "DELETE", ghost)).status, 404);
  assert.equal((await send(t.app, "POST", `${ghost}/folders`, { token: "z" })).status, 404);
  await t.dispose();
});

test("a delete removes the collection, and the state answer stops listing it", async () => {
  const t = await makeApp();
  const makeCollection = await send(t.app, "POST", "/api/collections", { name: "Gone" });
  const id = pick(makeCollection.body, "data.id") as string;
  const answer = await send(t.app, "DELETE", `/api/collections/${id}`);
  assert.deepEqual(pick(answer.body, "data.removed"), id);
  assert.deepEqual(await send(t.app, "GET", `/api/collections/${id}`).then((one) => one.status), 404);
  assert.deepEqual(pick(await send(t.app, "GET", "/api/state"), "data.collections"), []);
  await t.dispose();
});
