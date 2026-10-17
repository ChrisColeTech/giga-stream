import test from "node:test";
import assert from "node:assert/strict";

import { makeApp, pick, send, asOwner, signIn } from "./test-app.js";

const provider = { name: "JustWatch", source: "justwatch", api_key: "jw-api-key-123" };

test("a new backend lists no providers, with no sign-in", async () => {
  const t = await makeApp();
  assert.deepEqual((await send(t.app, "GET", "/api/providers")).body, { ok: true, data: { items: [] } });
});

test("a change needs a signed-in admin: no token and a bad one are auth.unauthorized", async () => {
  const t = await makeApp();
  for (const token of [undefined, "not-a-token"]) {
    const answer = await send(t.app, "POST", "/api/providers", provider, token);
    assert.equal(answer.status, 401);
    assert.equal(pick(answer.body, "error.code"), "auth.unauthorized");
  }
  assert.equal(pick((await send(t.app, "GET", "/api/providers")).body, "data.items.length"), 0);
});

test("an admin creates, reads, updates and deletes a provider", async () => {
  const t = await makeApp();
  const access = (await signIn(t.app)).access;

  // Create
  const created = await send(t.app, "POST", "/api/providers", provider, access);
  assert.equal(created.status, 201);
  const newId = Number(pick(created.body, "data.id"));
  assert.ok(newId > 0);
  assert.equal(pick(created.body, "data.name"), "JustWatch");
  assert.equal(pick(created.body, "data.source"), "justwatch");
  assert.equal(pick(created.body, "data.is_active"), true);

  // Read by id
  const got = await send(t.app, "GET", `/api/providers/${newId}`);
  assert.equal(pick(got.body, "data.name"), "JustWatch");

  // Update
  const updated = await send(t.app, "PUT", `/api/providers/${newId}`, { name: "JustWatch Updated" }, access);
  assert.equal(pick(updated.body, "data.name"), "JustWatch Updated");

  // Delete
  const removed = await send(t.app, "DELETE", `/api/providers/${newId}`, undefined, access);
  assert.equal(pick(removed.body, "data.id"), newId);
  const gone = await send(t.app, "GET", `/api/providers/${newId}`);
  assert.equal(pick(gone.body, "error.code"), "provider.not_found");
});

test("an invalid field is provider.invalid, naming the field", async () => {
  const t = await makeApp();
  const access = (await signIn(t.app)).access;

  const noName = await send(t.app, "POST", "/api/providers", { name: "", source: "test", api_key: "key" }, access);
  assert.equal(pick(noName.body, "error.code"), "provider.invalid");
  assert.equal(pick(noName.body, "error.details.field"), "name");

  const longSource = await send(t.app, "POST", "/api/providers", {
    name: "Test",
    source: "x".repeat(100),
    api_key: "key",
  }, access);
  assert.equal(pick(longSource.body, "error.code"), "provider.invalid");
  assert.equal(pick(longSource.body, "error.details.field"), "source");

  const longKey = await send(t.app, "POST", "/api/providers", {
    name: "Test",
    source: "test",
    api_key: "x".repeat(300),
  }, access);
  assert.equal(pick(longKey.body, "error.code"), "provider.invalid");
  assert.equal(pick(longKey.body, "error.details.field"), "api_key");
});

test("a provider change raises the revision a reader sees on its next read", async () => {
  const t = await makeApp();
  const before = Number(pick((await send(t.app, "GET", "/healthz")).body, "data.revision"));

  const access = (await signIn(t.app)).access;
  const created = await send(t.app, "POST", "/api/providers", provider, access);
  assert.equal(created.status, 201);

  const after = Number(pick((await send(t.app, "GET", "/healthz")).body, "data.revision"));
  assert.equal(after, before + 1);
});

test("an editor can manage providers", async () => {
  const t = await makeApp();
  const ownerAccess = (await signIn(t.app)).access;
  await send(t.app, "POST", "/api/admin-accounts", {
    name: "Editor",
    email: "editor@example.test",
    password: "editor-password-123",
    role: "editor",
  }, ownerAccess);

  const editorAccess = (await signIn(t.app, "editor@example.test", "editor-password-123")).access;
  const created = await send(t.app, "POST", "/api/providers", provider, editorAccess);
  assert.equal(created.status, 201);
});

const templated = {
  name: "VidSrc",
  source: "vidsrc",
  order: 2,
  family: "embed",
  movieTemplate: "https://vidsrc.sh/embed/movie/{tmdbId}",
  episodeTemplate: "https://vidsrc.sh/embed/tv/{tmdbId}/{season}/{episode}",
  startParam: "startAt",
  subtitlesParam: "ds_lang",
  origin: "https://vidsrc.sh",
  frameOrigins: ["https://vidsrc.sh"],
  messageShape: "vidsrc-status",
};

test("the template fields round-trip through create and update", async () => {
  const t = await makeApp();
  const access = (await signIn(t.app)).access;

  const created = await send(t.app, "POST", "/api/providers", templated, access);
  assert.equal(created.status, 201);
  const newId = Number(pick(created.body, "data.id"));
  assert.equal(pick(created.body, "data.order"), 2);
  assert.equal(pick(created.body, "data.family"), "embed");
  assert.equal(pick(created.body, "data.movieTemplate"), "https://vidsrc.sh/embed/movie/{tmdbId}");
  assert.equal(pick(created.body, "data.episodeTemplate"), "https://vidsrc.sh/embed/tv/{tmdbId}/{season}/{episode}");
  assert.equal(pick(created.body, "data.startParam"), "startAt");
  assert.equal(pick(created.body, "data.subtitlesParam"), "ds_lang");
  assert.equal(pick(created.body, "data.origin"), "https://vidsrc.sh");
  assert.deepEqual(pick(created.body, "data.frameOrigins"), ["https://vidsrc.sh"]);
  assert.equal(pick(created.body, "data.messageShape"), "vidsrc-status");

  // A fresh read sees the row, and a patch moves order and family and persists them.
  const updated = await send(t.app, "PUT", `/api/providers/${newId}`, { order: 7, family: "stream" }, access);
  assert.equal(updated.status, 200);
  const got = await send(t.app, "GET", `/api/providers/${newId}`);
  assert.equal(pick(got.body, "data.order"), 7);
  assert.equal(pick(got.body, "data.family"), "stream");
  assert.equal(pick(got.body, "data.movieTemplate"), "https://vidsrc.sh/embed/movie/{tmdbId}");
});

test("a provider without the new fields carries the defaults: order 0, family embed", async () => {
  const t = await makeApp();
  const access = (await signIn(t.app)).access;
  const created = await send(t.app, "POST", "/api/providers", provider, access);
  assert.equal(created.status, 201);
  assert.equal(pick(created.body, "data.order"), 0);
  assert.equal(pick(created.body, "data.family"), "embed");
  assert.equal(pick(created.body, "data.movieTemplate"), undefined);
  assert.equal(pick(created.body, "data.messageShape"), undefined);
});

test("a template refusal names the field and names the missing placeholder", async () => {
  const t = await makeApp();
  const access = (await signIn(t.app)).access;

  const noPlaceholder = await send(t.app, "POST", "/api/providers", {
    ...templated,
    name: "X",
    source: "x",
    movieTemplate: "https://vidsrc.sh/embed/movie/603",
  }, access);
  assert.equal(pick(noPlaceholder.body, "error.code"), "provider.invalid");
  assert.equal(pick(noPlaceholder.body, "error.details.field"), "movieTemplate");

  const missingEpisode = await send(t.app, "POST", "/api/providers", {
    ...templated,
    name: "X",
    source: "x",
    episodeTemplate: "https://vidsrc.sh/embed/tv/{tmdbId}/{season}",
  }, access);
  assert.equal(pick(missingEpisode.body, "error.details.field"), "episodeTemplate");

  const plainHttp = await send(t.app, "POST", "/api/providers", {
    ...templated,
    name: "X",
    source: "x",
    movieTemplate: "http://vidsrc.sh/embed/movie/{tmdbId}",
  }, access);
  assert.equal(pick(plainHttp.body, "error.details.field"), "movieTemplate");

  const fileOrigin = await send(t.app, "POST", "/api/providers", {
    ...templated,
    name: "X",
    source: "x",
    origin: "http://vidsrc.sh/player",
  }, access);
  assert.equal(pick(fileOrigin.body, "error.details.field"), "origin");

  const badShape = await send(t.app, "PUT", `/api/providers/1`, { messageShape: "media-data" }, access);
  assert.equal(pick(badShape.body, "error.details.field"), "messageShape");
});
