import test from "node:test";
import assert from "node:assert/strict";

import { asOwner as admin, connectSocket, makeApp, pick } from "./test-app.js";

const channel = { name: "News", category: "News", streamUrl: "https://live.example/news.m3u8" };

test("the first frame is hello with the version and current revision, with no credential", async () => {
  const t = await makeApp({ seed: true });
  const socket = await connectSocket(t.app);
  assert.deepEqual(await socket.next(), { type: "hello", data: { version: "0.1.0", revision: 4 } });
  socket.close();
});

// A successful ws send calls back with null; reading that as a failure once dropped the session after
// hello. This goes through a real connection.
test("every change is announced as channels.changed with its revision", async () => {
  const t = await makeApp();
  const socket = await connectSocket(t.app);
  await socket.next();
  const created = await admin(t.app, "POST", "/api/channels", channel);
  assert.deepEqual(await socket.next(), { type: "channels.changed", data: { revision: 1 } });
  const id = String(pick(created.body, "data.id"));
  await admin(t.app, "PATCH", `/api/channels/${id}`, { name: "World" });
  assert.deepEqual(await socket.next(), { type: "channels.changed", data: { revision: 2 } });
  await admin(t.app, "DELETE", `/api/channels/${id}`);
  assert.deepEqual(await socket.next(), { type: "channels.changed", data: { revision: 3 } });
  socket.close();
});

test("a refused change announces nothing", async () => {
  const t = await makeApp();
  const socket = await connectSocket(t.app);
  await socket.next();
  await admin(t.app, "POST", "/api/channels", { ...channel, streamUrl: "http://nope.example/a" });
  await admin(t.app, "POST", "/api/channels", channel);
  assert.deepEqual(await socket.next(), { type: "channels.changed", data: { revision: 1 } });
  socket.close();
});

test("ping is answered with pong; five bad frames close the socket with 1008", async () => {
  const t = await makeApp();
  const socket = await connectSocket(t.app);
  await socket.next();
  socket.send(JSON.stringify({ type: "ping" }));
  const pong = await socket.next();
  assert.equal(pick(pong, "type"), "pong");
  assert.equal(typeof pick(pong, "data.at"), "number");
  for (const bad of ["not json", JSON.stringify({ type: "publish" }), JSON.stringify([]), JSON.stringify({ type: "ping", x: 1 })]) {
    socket.send(bad);
  }
  // Still open after four violations: a change is still delivered.
  await admin(t.app, "POST", "/api/channels", channel);
  assert.equal(pick(await socket.next(), "type"), "channels.changed");
  socket.send("one too many");
  assert.equal(await socket.closed(), 1008);
});

test("a reconnect gets a fresh hello at the current revision, with no replay", async () => {
  const t = await makeApp();
  const one = await connectSocket(t.app);
  await one.next();
  await admin(t.app, "POST", "/api/channels", channel);
  await one.next();
  one.close();
  await one.closed();
  const two = await connectSocket(t.app);
  assert.deepEqual(await two.next(), { type: "hello", data: { version: "0.1.0", revision: 1 } });
  two.close();
});
