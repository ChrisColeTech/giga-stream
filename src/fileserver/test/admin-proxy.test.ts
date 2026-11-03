import assert from "node:assert/strict";
import test from "node:test";

import { makeApp, pick, send } from "./app-fixture.js";
import { startFakeUpstream } from "./fake-backend.js";

test("the optional proxy exposes only live and logo bytes", async () => {
  const upstream = await startFakeUpstream();
  const t = await makeApp({ adminProxyTarget: upstream.url });
  try {
    const live = await send(t.app, "GET", "/live/channel/master.m3u8");
    const logo = await send(t.app, "GET", "/logos/c/logo.png");
    assert.equal(pick(live.body, "data.path"), "/live/channel/master.m3u8");
    assert.equal(pick(logo.body, "data.path"), "/logos/c/logo.png");
    const blocked = await send(t.app, "GET", "/api/admin/channels");
    assert.equal(blocked.status, 404);
    assert.deepEqual(upstream.seen.map((hit) => hit.path), [
      "/live/channel/master.m3u8", "/logos/c/logo.png",
    ]);
  } finally {
    await t.dispose();
    await upstream.close();
  }
});
