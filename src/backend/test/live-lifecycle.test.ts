// The live runtime inside the backend (docs/26 section 3.5): start, restart, delete, rebuild and shutdown,
// and a failing channel that never takes the backend down. The build is fake, so no program runs.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { itemOf, liveBody, VIDEOS } from "./live-channel-kit.js";
import { makeApp, pick, send, signIn } from "./test-app.js";

const states = async (t: Awaited<ReturnType<typeof makeApp>>, token: string) => {
  const items = pick((await send(t.app, "GET", "/api/admin-channels", undefined, token)).body, "data.items");
  return Object.fromEntries((Array.isArray(items) ? items : []).map((item) => [pick(item, "id"), pick(item, "state")]));
};

test("saved live channels build in the background at start and the backend answers at once", async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-backend-live-restart-"));
  try {
    const first = await makeApp({ dataDir });
    const token = (await signIn(first.app)).access;
    await send(first.app, "POST", "/api/channels", liveBody(), token);
    await send(first.app, "POST", "/api/channels", liveBody({ id: "other", number: 8 }), token);
    await first.live.settled();
    await first.dispose();
    assert.deepEqual([first.tally.built, first.tally.stopped], [2, 2]);

    const second = await makeApp({ dataDir });
    const again = (await signIn(second.app)).access;
    // The start does not wait on the builds: it answers, and the channels settle in the background.
    assert.equal((await send(second.app, "GET", "/healthz")).status, 200);
    await second.live.settled();
    assert.deepEqual(await states(second, again), { home: "live", other: "live" });
    assert.equal(pick((await send(second.app, "GET", "/healthz")).body, "data.liveChannels"), 2);
    await second.dispose();
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("a failing channel becomes failed with its problem and never takes the backend down", async () => {
  const t = await makeApp();
  const token = (await signIn(t.app)).access;
  await send(t.app, "POST", "/api/channels", liveBody(), token);
  const broken = await send(t.app, "POST", "/api/channels", liveBody({ id: "bad", number: 8, videos: [VIDEOS.a, VIDEOS.broken] }), token);
  assert.equal(broken.status, 201);
  await t.live.settled();
  const admin = await send(t.app, "GET", "/api/admin-channels", undefined, token);
  assert.deepEqual([itemOf(admin.body, "home").state, itemOf(admin.body, "bad").state], ["live", "failed"]);
  assert.match(String(itemOf(admin.body, "bad").problem), /broken-1\.mp4 cannot be played/);
  assert.equal(itemOf(admin.body, "home").problem, undefined);
  // The backend and the healthy channel carry on; the failed one has no stream, and can be mended.
  assert.equal((await send(t.app, "GET", "/healthz")).status, 200);
  assert.equal((await send(t.app, "GET", "/live/home/master.m3u8")).status, 200);
  assert.equal((await send(t.app, "GET", "/live/bad/master.m3u8")).status, 404);
  await send(t.app, "PATCH", "/api/channels/bad", { videos: [VIDEOS.a] }, token);
  await t.live.settled();
  assert.equal(itemOf((await send(t.app, "GET", "/api/admin-channels", undefined, token)).body, "bad").state, "live");
});

test("a failed channel saved before a restart is rebuilt at start without crashing it", async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-backend-live-failed-"));
  try {
    const first = await makeApp({ dataDir });
    const token = (await signIn(first.app)).access;
    await send(first.app, "POST", "/api/channels", liveBody({ videos: [VIDEOS.broken] }), token);
    await first.live.settled();
    await first.dispose();
    const second = await makeApp({ dataDir });
    await second.live.settled();
    const admin = await send(second.app, "GET", "/api/admin-channels", undefined, (await signIn(second.app)).access);
    assert.equal(itemOf(admin.body, "home").state, "failed");
    await second.dispose();
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("delete stops the runtime before the row goes, and the stream goes with it", async () => {
  const t = await makeApp();
  const token = (await signIn(t.app)).access;
  await send(t.app, "POST", "/api/channels", liveBody(), token);
  await t.live.settled();
  assert.equal((await send(t.app, "GET", "/live/home/master.m3u8")).status, 200);
  assert.deepEqual((await send(t.app, "DELETE", "/api/channels/home", undefined, token)).body, { ok: true, data: { id: "home" } });
  assert.equal(t.tally.stopped, 1);
  assert.equal(pick((await send(t.app, "GET", "/api/channels/home")).body, "error.code"), "channel.not_found");
  assert.equal((await send(t.app, "GET", "/live/home/master.m3u8")).status, 404);
  assert.equal((await send(t.app, "GET", "/logos/home.png")).status, 404);
  assert.equal((await send(t.app, "DELETE", "/api/channels/home", undefined, token)).status, 404);
});

test("closing the backend stops every live stream, and a build still running is abandoned", async () => {
  const t = await makeApp();
  const token = (await signIn(t.app)).access;
  await send(t.app, "POST", "/api/channels", liveBody(), token);
  await send(t.app, "POST", "/api/channels", liveBody({ id: "other", number: 8 }), token);
  await t.live.settled();
  // A third channel is saved and closed on while its build is in flight: it is never left running.
  await send(t.app, "POST", "/api/channels", liveBody({ id: "third", number: 9 }), token);
  await t.dispose();
  assert.equal(t.tally.stopped, t.tally.built, "every stream that was built was stopped");
  assert.ok(t.tally.built >= 2);
});

test("a rebuild re-reads the source and rebuilds; stream rows and unknown ids have none", async () => {
  const t = await makeApp();
  const token = (await signIn(t.app)).access;
  await send(t.app, "POST", "/api/channels", liveBody({ videos: undefined, folder: VIDEOS.folder }), token);
  await t.live.settled();
  const revision = pick((await send(t.app, "GET", "/api/channels")).body, "data.revision");
  const rebuilt = await send(t.app, "POST", "/api/channels/home/rebuild", undefined, token);
  assert.deepEqual([rebuilt.status, pick(rebuilt.body, "data.state"), pick(rebuilt.body, "data.folder")], [200, "preparing", VIDEOS.folder]);
  await t.live.settled();
  assert.equal(itemOf((await send(t.app, "GET", "/api/admin-channels", undefined, token)).body, "home").state, "live");
  assert.equal(pick((await send(t.app, "GET", "/api/channels")).body, "data.revision"), revision, "no row changed");
  const stream = String(pick((await send(t.app, "POST", "/api/channels", { name: "N", category: "News", streamUrl: "https://a.example/n.m3u8" }, token)).body, "data.id"));
  const refused = await send(t.app, "POST", `/api/channels/${stream}/rebuild`, undefined, token);
  assert.deepEqual([refused.status, pick(refused.body, "error.code"), pick(refused.body, "error.details.field")], [422, "channel.invalid", "kind"]);
  assert.equal((await send(t.app, "POST", "/api/channels/missing/rebuild", undefined, token)).status, 404);
});

test("live writes raise the revision and write audit entries as stream rows do", async () => {
  const t = await makeApp();
  const token = (await signIn(t.app)).access;
  const revisions: unknown[] = [];
  const revision = async () => pick((await send(t.app, "GET", "/api/channels")).body, "data.revision");
  await send(t.app, "POST", "/api/channels", liveBody(), token);
  revisions.push(await revision());
  await send(t.app, "PATCH", "/api/channels/home", { name: "Family" }, token);
  revisions.push(await revision());
  await send(t.app, "POST", "/api/channels/home/rebuild", undefined, token);
  await send(t.app, "PUT", "/api/channels/home/fault", { fault: "stall" }, token);
  await send(t.app, "DELETE", "/api/channels/home/fault", undefined, token);
  await t.live.settled();
  await send(t.app, "DELETE", "/api/channels/home", undefined, token);
  revisions.push(await revision());
  assert.deepEqual(revisions, [1, 2, 3]);
  const audit = await send(t.app, "GET", "/api/audit", undefined, token);
  const actions = (pick(audit.body, "data.items") as Array<Record<string, unknown>>).map((entry) => entry.action);
  assert.deepEqual(actions.slice(0, 6), [
    "channel.deleted", "channel.fault_cleared", "channel.fault_set", "channel.rebuilt", "channel.updated", "channel.created",
  ]);
  const created = (pick(audit.body, "data.items") as Array<Record<string, unknown>>)[5];
  assert.deepEqual([created?.subject, created?.actorEmail, pick(created, "detail.kind")], ["home", "owner@example.test", "live"]);
});
