// A playlist's sync job (docs/43 section 3.4): a file playlist reads nothing; a web playlist is fetched on every run and
// imported; a run is started and answered `202`; the result is typed. Steps 3 to 5 have their own tests (`sync-*.test.ts`).
import assert from "node:assert/strict";
import test from "node:test";

import { ONE, M3U, entry, playlistOf, setupPlaylists, uploadFile, until } from "./playlist-kit.js";
import { pick } from "./test-app.js";

type Setup = Awaited<ReturnType<typeof setupPlaylists>>;

const jobOf = async (s: Setup): Promise<Record<string, unknown>> =>
  ((pick((await s.api("GET", "/api/jobs")).body, "data.items") as Array<Record<string, unknown>>).find((j) => j.type === "playlist") ?? {});

/** Starts the playlist's job and waits for the run to settle; answers the job as then read. */
async function runJob(s: Setup): Promise<Record<string, unknown>> {
  const id = Number((await jobOf(s)).id);
  const before = (await jobOf(s)).lastRunAt;
  s.t.clock.advance(1000);
  const started = await s.api("POST", `/api/jobs/${id}/run`);
  assert.deepEqual([started.status, pick(started.body, "data.running")], [202, true]);
  await until(async () => (await jobOf(s)).lastRunAt !== before, "the run");
  return jobOf(s);
}

test("a file playlist is never read again: the run records a typed result and fetches nothing", async () => {
  const s = await setupPlaylists();
  await uploadFile(s.t, s.token, "mine.m3u", M3U);
  const done = await runJob(s);
  assert.deepEqual([done.lastResult, done.running], ["ok", false]);
  assert.deepEqual(done.lastCounts, {
    created: 0, updated: 0, skipped: 0, refused: 0, source: "file", logosCached: 0, logosFailed: 0, online: 0, offline: 2,
    unchecked: 0, refusalExamples: [],
  });
  assert.deepEqual(s.feed.asked, [], "no playlist address is read");
  assert.equal(s.feed.everything.filter((url) => url.startsWith("https://stream.example/")).length, 2, "each stream is checked");
  assert.equal(done.lastRunAt, s.t.clock.now());
  const view = pick((await s.api("GET", "/api/playlists/1")).body, "data") as Record<string, unknown>;
  assert.deepEqual([view.lastResult, view.lastRunAt, pick(view, "lastCounts.source")], ["ok", done.lastRunAt, "file"]);
  const synced = (await s.audit()).find((e) => e.action === "playlist.synced");
  assert.deepEqual([pick(synced, "detail.result"), pick(synced, "detail.source")], ["ok", "file"]);
});

test("a web playlist is fetched on every run and writes only when something changed, with one revision", async () => {
  const s = await setupPlaylists();
  await s.importUrl(ONE);
  const rows = await s.adminChannels();
  await s.api("PATCH", `/api/channels/${rows[0]?.id}`, { enabled: true });
  const settled = await s.revision();
  const quiet = await runJob(s);
  assert.deepEqual([pick(quiet, "lastCounts.source"), pick(quiet, "lastCounts.created"), pick(quiet, "lastCounts.updated")], ["unchanged", 0, 0]);
  assert.deepEqual([s.feed.asked.length, await s.revision()], [2, settled], "fetched again, wrote nothing");

  s.feed.set(ONE, playlistOf(entry("ABC", "abc-2", 'tvg-id="a" '), entry("ESPN", "espn"), entry("Cartoon", "cartoon")));
  const changed = await runJob(s);
  assert.deepEqual(["source", "created", "updated"].map((f) => pick(changed, `lastCounts.${f}`)), ["updated", 1, 1]);
  assert.equal(await s.revision(), settled + 1);
  const after = await s.adminChannels();
  assert.deepEqual(after.map((r) => [r.name, r.enabled]), [["ABC", true], ["Cartoon", false], ["ESPN", false]], "a manual enable survives; new is disabled");
  assert.equal(after.find((r) => r.name === "ABC")?.streamUrl, "https://stream.example/abc-2.m3u8");
  assert.equal(s.feed.asked.length, 3);
});

test("an unreachable or no-longer-M3U address is recorded as such, the run is still ok, and nothing is written", async () => {
  const s = await setupPlaylists();
  await s.importUrl(ONE);
  const settled = await s.revision();
  s.feed.fail(ONE, "safe_fetch.timeout");
  const down = await runJob(s);
  assert.deepEqual([down.lastResult, pick(down, "lastCounts.source")], ["ok", "unreachable"]);
  s.feed.heal(ONE);
  s.feed.set(ONE, "<html>moved</html>");
  const html = await runJob(s);
  assert.deepEqual([html.lastResult, pick(html, "lastCounts.source")], ["ok", "unreachable"]);
  s.feed.set(ONE, "gone");
  assert.equal(pick(await runJob(s), "lastCounts.source"), "unreachable");
  assert.equal(await s.revision(), settled);
  assert.equal((await s.adminChannels()).length, 2, "nothing is deleted");
  assert.equal(JSON.stringify(await jobOf(s)).includes("SECRET-VALUE"), false);
});

test("one run per playlist: a second start is 409 sync.busy while the first holds; it is not awaited by the route", async () => {
  const s = await setupPlaylists();
  await s.importUrl(ONE);
  const id = Number((await jobOf(s)).id);
  const gate = s.feed.hold(ONE);
  const first = await s.api("POST", `/api/jobs/${id}/run`);
  assert.equal(first.status, 202, "answered while the fetch is still held");
  await gate.started;
  const second = await s.api("POST", `/api/jobs/${id}/run`);
  assert.deepEqual([second.status, pick(second.body, "error.code")], [409, "sync.busy"]);
  assert.equal((await jobOf(s)).running, true);
  gate.release();
  await until(async () => (await jobOf(s)).running === false, "the run to end");
  assert.equal((await jobOf(s)).lastResult, "ok");
});

test("a disabled playlist refuses a manual run with 422 job.disabled; a disabled job still runs by hand", async () => {
  const s = await setupPlaylists();
  await uploadFile(s.t, s.token, "mine.m3u", M3U);
  const id = Number((await jobOf(s)).id);
  await s.api("PATCH", "/api/playlists/1", { enabled: false });
  const refused = await s.api("POST", `/api/jobs/${id}/run`);
  assert.deepEqual([refused.status, pick(refused.body, "error.code")], [422, "job.disabled"]);
  assert.match(String(pick(refused.body, "error.message")), /playlist is disabled/);
  await s.api("PATCH", "/api/playlists/1", { enabled: true });
  await s.api("PATCH", `/api/jobs/${id}`, { enabled: false });
  assert.equal((await s.api("POST", `/api/jobs/${id}/run`)).status, 202, "the job's switch stops only the schedule");
  assert.equal((await s.api("POST", "/api/jobs/99/run")).status, 404);
});
