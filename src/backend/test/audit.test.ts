// The audit entries of an update, a rebuild, a fault and a revert name the record they changed, not only its id
// (docs/29 section 18, B5).
import assert from "node:assert/strict";
import test from "node:test";

import type { FastifyInstance } from "fastify";

import { liveBody, streamBody } from "./live-channel-kit.js";
import { makeApp, pick, send, signIn } from "./test-app.js";

/** The newest audit entry with this action, as the log answers it. */
async function latest(app: FastifyInstance, token: string, action: string): Promise<unknown> {
  const answer = await send(app, "GET", "/api/audit?limit=200", undefined, token);
  const items = pick(answer.body, "data.items");
  return Array.isArray(items) ? items.find((entry) => pick(entry, "action") === action) : undefined;
}

test("an update of a provider, a playlist, a manual title or a stream channel names the record", async () => {
  const t = await makeApp();
  const token = (await signIn(t.app)).access;

  const provider = await send(t.app, "POST", "/api/providers", { name: "JustWatch", source: "justwatch" }, token);
  await send(t.app, "PUT", `/api/providers/${pick(provider.body, "data.id")}`, { name: "JustWatch 2" }, token);
  assert.equal(pick(await latest(t.app, token, "provider.updated"), "detail.name"), "JustWatch 2");

  const address = "https://other.example/all.m3u8";
  const playlist = await send(t.app, "POST", "/api/playlists", { name: "Main", address }, token);
  await send(t.app, "PATCH", `/api/playlists/${pick(playlist.body, "data.id")}`, { enabled: false }, token);
  assert.equal(pick(await latest(t.app, token, "playlist.updated"), "detail.name"), "Main");

  const title = await send(t.app, "POST", "/api/titles", { kind: "movie", title: "Home Movie", year: 2020 }, token);
  await send(t.app, "PATCH", `/api/titles/${pick(title.body, "data.id")}`, { year: 2021 }, token);
  assert.equal(pick(await latest(t.app, token, "title.updated"), "detail.name"), "Home Movie");

  const channel = await send(t.app, "POST", "/api/channels", { kind: "stream", ...streamBody() }, token);
  await send(t.app, "PATCH", `/api/channels/${pick(channel.body, "data.id")}`, { name: "Newsroom" }, token);
  assert.equal(pick(await latest(t.app, token, "channel.updated"), "detail.name"), "Newsroom");
});

test("a live channel's rebuild and its fault entries name the channel", async () => {
  const t = await makeApp();
  const token = (await signIn(t.app)).access;
  const { name } = liveBody();
  await send(t.app, "POST", "/api/channels", liveBody(), token);
  await send(t.app, "POST", "/api/channels/home/rebuild", undefined, token);
  await send(t.app, "PUT", "/api/channels/home/fault", { fault: "stall" }, token);
  await send(t.app, "DELETE", "/api/channels/home/fault", undefined, token);
  await t.live.settled();
  for (const action of ["channel.rebuilt", "channel.fault_set", "channel.fault_cleared"]) {
    assert.equal(pick(await latest(t.app, token, action), "detail.name"), name, action);
  }
  assert.equal(pick(await latest(t.app, token, "channel.fault_set"), "detail.fault"), "stall");
});
