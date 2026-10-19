// GET /api/admin/jobs/events (docs/44 section 3.3) over a real socket: signed in at connect, the hand-written event-stream headers
// of a hijacked reply, the snapshot first, at most eight streams, a closed client leaves, and shutdown ends open streams.
import assert from "node:assert/strict";
import test from "node:test";

import { EVENT_SUBSCRIBERS_MAX } from "../src/constants/limits.js";
import { until } from "./playlist-kit.js";
import { openEvents, type EventsClient } from "./sse-kit.js";
import { makeApp, pick, signIn } from "./test-app.js";

async function listening(config: Record<string, unknown> = {}) {
  const t = await makeApp({ config });
  const base = await t.app.listen({ port: 0, host: "127.0.0.1" });
  return { t, base, token: (await signIn(t.app)).access };
}

test("the stream needs a signed-in admin at connect: 401 as a normal error, no stream", async () => {
  const { base, token } = await listening();
  for (const bad of [undefined, "not-a-token"]) {
    const refused = await openEvents(base, bad);
    assert.equal(refused.status, 401);
    assert.equal(pick(JSON.parse(refused.body()), "error.code"), "auth.unauthorized");
    assert.equal(refused.headers["cache-control"], "no-store");
  }
  const open = await openEvents(base, token);
  assert.equal(open.status, 200);
  open.destroy();
});

test("the headers are written by hand and the snapshot is the first frame", async () => {
  const { base, token } = await listening({ CORS_ORIGINS: "http://localhost:5172" });
  const stream = await openEvents(base, token, { origin: "http://localhost:5172" });
  assert.deepEqual(
    [stream.status, stream.headers["content-type"], stream.headers["cache-control"], stream.headers["x-accel-buffering"]],
    [200, "text/event-stream", "no-store", "no"],
  );
  assert.equal(stream.headers["access-control-allow-origin"], "http://localhost:5172", "the CORS headers earlier hooks set are carried over");
  await stream.waitFor((frames) => frames.length > 0, "the snapshot");
  assert.deepEqual(stream.frames(), [{ event: "snapshot", data: { running: [] } }]);
  stream.destroy();
});

test("at most eight streams are open; the ninth is a normal 429, and a closed client makes room", async () => {
  const { base, token } = await listening();
  const open: EventsClient[] = [];
  for (let i = 0; i < EVENT_SUBSCRIBERS_MAX; i++) open.push(await openEvents(base, token));
  await Promise.all(open.map((s) => s.waitFor((frames) => frames.length > 0, "a snapshot")));
  const ninth = await openEvents(base, token);
  assert.equal(ninth.status, 429);
  assert.equal(pick(JSON.parse(ninth.body()), "error.code"), "job.events_busy");
  open[0]?.destroy();
  await until(async () => (await openEvents(base, token).then((s) => (s.status === 200 ? (s.destroy(), true) : false))), "room after a disconnect");
  for (const s of open) s.destroy();
});

test("a disconnect cleans up: after every client leaves, eight new streams open again", async () => {
  const { base, token } = await listening();
  for (let round = 0; round < 2; round++) {
    const open: EventsClient[] = [];
    await until(async () => {
      for (const s of open.splice(0)) s.destroy();
      for (let i = 0; i < EVENT_SUBSCRIBERS_MAX; i++) open.push(await openEvents(base, token));
      const accepted = open.every((s) => s.status === 200);
      if (!accepted) for (const s of open) s.destroy();
      return accepted;
    }, `eight streams in round ${round}`);
    await Promise.all(open.map((s) => s.waitFor((frames) => frames.length > 0, "a snapshot")));
    for (const s of open) s.destroy();
  }
});

test("shutdown ends open streams, so an open stream never hangs it", async () => {
  const { t, base, token } = await listening();
  const stream = await openEvents(base, token);
  await stream.waitFor((frames) => frames.length > 0, "the snapshot");
  const closing = t.app.close();
  const hung = Symbol("hung");
  const outcome = await Promise.race([closing.then(() => "closed"), new Promise((resolve) => setTimeout(() => resolve(hung), 5_000))]);
  assert.equal(outcome, "closed", "app.close() finished with a stream open");
  await stream.closed;
});
