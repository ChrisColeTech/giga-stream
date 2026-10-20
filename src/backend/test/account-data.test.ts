// The app's data routes (docs/62 section 3.3): settings whole-document replace, favorites, collections and
// their items, every answer scoped to the signed-in account, and two accounts never see each other's rows.
import test from "node:test";
import assert from "node:assert/strict";

import { makeApp, pick, send, signIn, type TestApp } from "./test-app.js";

const A = { username: "account-a", password: "a-password-1234" };
const B = { username: "account-b", password: "b-password-1234" };
const SETTINGS = { theme: "light", watchedPercent: 95, libraryGenres: ["Drama"], audioLanguage: null };

const code = (answer: { body: unknown }): unknown => pick(answer.body, "error.code");

/** The admin mints the two accounts and answers their access tokens. */
async function twoAccounts(t: TestApp): Promise<{ a: string; b: string }> {
  const token = (await signIn(t.app)).access;
  for (const account of [A, B]) {
    const made = await send(t.app, "POST", "/api/admin/accounts", { ...account, kind: "user" }, token);
    assert.equal(made.status, 201);
  }
  const accessOf = async (account: typeof A): Promise<string> => {
    const answer = await send(t.app, "POST", "/api/account/auth/login", account);
    assert.equal(answer.status, 200);
    return String(pick(answer.body, "data.accessToken"));
  };
  return { a: await accessOf(A), b: await accessOf(B) };
}

test("settings round-trip: an empty document first, PUT replaces whole, the answer is no-store", async () => {
  const t = await makeApp();
  const { a } = await twoAccounts(t);

  const first = await send(t.app, "GET", "/api/account/settings", undefined, a);
  assert.deepEqual([first.status, pick(first.body, "data.settings")], [200, {}]);
  assert.equal(first.headers["cache-control"], "no-store");

  const put = await send(t.app, "PUT", "/api/account/settings", SETTINGS, a);
  assert.deepEqual([put.status, pick(put.body, "data.settings"), pick(put.body, "data.updatedAt")],
    [200, SETTINGS, t.clock.now()]);
  const got = await send(t.app, "GET", "/api/account/settings", undefined, a);
  assert.deepEqual(pick(got.body, "data.settings"), SETTINGS);
});

test("a settings document that fails its grammar is refused whole, naming nothing it stored", async () => {
  const t = await makeApp();
  const { a } = await twoAccounts(t);
  for (const body of [
    { theme: "sepia" },
    { watchedPercent: 93 },
    { libraryGenres: "Drama" },
    { unknownKey: true },
  ]) {
    const answer = await send(t.app, "PUT", "/api/account/settings", body, a);
    assert.deepEqual([answer.status, code(answer)], [422, "settings.invalid"], JSON.stringify(body));
  }
  assert.deepEqual(pick((await send(t.app, "GET", "/api/account/settings", undefined, a)).body, "data.settings"), {});
});

test("favorites: put is idempotent, delete removes, the list answers refs with their created_at", async () => {
  const t = await makeApp();
  const { a } = await twoAccounts(t);

  const put = await send(t.app, "PUT", "/api/account/favorites/title/movie-603", undefined, a);
  assert.deepEqual(
    [put.status, pick(put.body, "data")],
    [200, { ref: { kind: "title", id: "movie-603" }, favorite: true }],
  );
  await send(t.app, "PUT", "/api/account/favorites/title/movie-603", undefined, a);
  await send(t.app, "PUT", "/api/account/favorites/local/file-9", undefined, a);

  const list = await send(t.app, "GET", "/api/account/favorites", undefined, a);
  assert.deepEqual(list.body, {
    ok: true,
    data: {
      // The list's order: created_at, then the ref, so an equal clock still answers deterministically.
      items: [
        { ref: { kind: "local", id: "file-9" }, favorite: true, createdAt: t.clock.now() },
        { ref: { kind: "title", id: "movie-603" }, favorite: true, createdAt: t.clock.now() },
      ],
    },
  });

  const gone = await send(t.app, "DELETE", "/api/account/favorites/title/movie-603", undefined, a);
  assert.deepEqual(pick(gone.body, "data"), { ref: { kind: "title", id: "movie-603" }, favorite: false });
  assert.deepEqual(pick((await send(t.app, "GET", "/api/account/favorites", undefined, a)).body, "data.items.0.ref"),
    { kind: "local", id: "file-9" });

  const badKind = await send(t.app, "PUT", "/api/account/favorites/genre/movie-603", undefined, a);
  assert.equal(badKind.status, 400);
});

test("collections: create, list, patch, add and remove items, delete, and where an item is", async () => {
  const t = await makeApp();
  const { a } = await twoAccounts(t);

  const made = await send(t.app, "POST", "/api/account/collections", { name: "  Weekend  ", type: "movie" }, a);
  assert.deepEqual([made.status, pick(made.body, "data.itemCount")], [201, 0]);
  const id = String(pick(made.body, "data.id"));

  const added = await send(t.app, "PUT", `/api/account/collections/${id}/items`, { kind: "title", id: "movie-603" }, a);
  assert.deepEqual([added.status, pick(added.body, "data.itemCount")], [200, 1]);

  const renamed = await send(t.app, "PATCH", `/api/account/collections/${id}`, { name: "Friday" }, a);
  assert.deepEqual([pick(renamed.body, "data.name"), pick(renamed.body, "data.type")], ["Friday", "movie"]);

  const list = await send(t.app, "GET", "/api/account/collections", undefined, a);
  assert.deepEqual((pick(list.body, "data.items") as unknown[]).length, 1);

  const where = await send(t.app, "GET", "/api/account/items/title/movie-603/collections", undefined, a);
  assert.deepEqual(pick(where.body, "data.memberships"), [{ collectionId: id, source: "manual" }]);

  await send(t.app, "DELETE", `/api/account/collections/${id}/items/title/movie-603`, undefined, a);
  const emptied = await send(t.app, "GET", "/api/account/collections", undefined, a);
  assert.equal(pick(emptied.body, "data.items.0.itemCount"), 0);

  const dropped = await send(t.app, "DELETE", `/api/account/collections/${id}`, undefined, a);
  assert.deepEqual(dropped.body, { ok: true, data: { removed: id } });
  assert.deepEqual(pick((await send(t.app, "GET", "/api/account/collections", undefined, a)).body, "data.items"), []);
  const gone = await send(t.app, "GET", "/api/account/items/title/movie-603/collections", undefined, a);
  assert.deepEqual(pick(gone.body, "data.memberships"), []);
});

test("a collection is created whole: a blank name, a bad type or an unknown field is collection.invalid", async () => {
  const t = await makeApp();
  const { a } = await twoAccounts(t);
  for (const body of [
    { name: "   ", type: "movie" },
    { name: "X", type: "disc" },
    { name: "X", type: "movie", extra: 1 },
  ]) {
    const made = await send(t.app, "POST", "/api/account/collections", body, a);
    assert.deepEqual([made.status, code(made)], [422, "collection.invalid"], JSON.stringify(body));
  }
});

test("two accounts never see each other's rows", async () => {
  const t = await makeApp();
  const { a, b } = await twoAccounts(t);

  await send(t.app, "PUT", "/api/account/settings", SETTINGS, a);
  await send(t.app, "PUT", "/api/account/favorites/title/movie-603", undefined, a);
  const made = await send(t.app, "POST", "/api/account/collections", { name: "Mine", type: "tv" }, a);
  const foreignId = String(pick(made.body, "data.id"));

  assert.deepEqual(pick((await send(t.app, "GET", "/api/account/settings", undefined, b)).body, "data.settings"), {});
  assert.deepEqual(pick((await send(t.app, "GET", "/api/account/favorites", undefined, b)).body, "data.items"), []);
  assert.deepEqual(pick((await send(t.app, "GET", "/api/account/collections", undefined, b)).body, "data.items"), []);

  // The other account's id reads as absent: no read, no write, no hint it exists.
  const stolen = await send(t.app, "GET", `/api/account/collections/${foreignId}`, undefined, b);
  assert.equal(stolen.status, 404);
  const rename = await send(t.app, "PATCH", `/api/account/collections/${foreignId}`, { name: "Stolen" }, b);
  assert.equal(rename.status, 404);
  const drop = await send(t.app, "DELETE", `/api/account/collections/${foreignId}`, undefined, b);
  assert.equal(drop.status, 404);
  const addItem = await send(
    t.app, "PUT", `/api/account/collections/${foreignId}/items`, { kind: "title", id: "x" }, b,
  );
  assert.equal(addItem.status, 404);

  await send(t.app, "PUT", "/api/account/favorites/title/local-1", undefined, b);
  const aList = await send(t.app, "GET", "/api/account/favorites", undefined, a);
  assert.equal((pick(aList.body, "data.items") as unknown[]).length, 1, "a's set is untouched by b's write");

  const where = await send(t.app, "GET", "/api/account/items/title/movie-603/collections", undefined, b);
  assert.deepEqual(pick(where.body, "data.memberships"), []);
});

test("every data route needs a signed-in account", async () => {
  const t = await makeApp();
  for (const [method, url] of [
    ["GET", "/api/account/me"], ["GET", "/api/account/settings"],
    ["PUT", "/api/account/settings"], ["GET", "/api/account/favorites"],
    ["PUT", "/api/account/favorites/title/x"], ["GET", "/api/account/collections"],
    ["POST", "/api/account/collections"],
  ] as const) {
    const body = method === "PUT" ? {} : method === "POST" ? { name: "x", type: "movie" } : undefined;
    const answer = await send(t.app, method, url, body);
    assert.deepEqual([answer.status, code(answer)], [401, "auth.unauthorized"], url);
  }
});
