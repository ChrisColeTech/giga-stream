import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bulkSummary, runBulk } from "@/lib/bulk-plan";
import { deleteWords, jobForPlaylists, planPlaylistBulk, playlistVerbReason } from "@/lib/playlist-bulk";
import type { AdminJob } from "@/services/schemas/job-schema";
import type { AdminPlaylist } from "@/services/schemas/playlist-schema";

const row = (id: number, enabled = true): AdminPlaylist => ({
  id,
  name: `List ${id}`,
  host: "h.test",
  masked: "h.test/…",
  enabled,
  channels: 0,
});
const job = (id: number, playlistId: number, enabled = true, running = false): AdminJob => ({
  id,
  name: `Job ${id}`,
  type: "playlist",
  enabled,
  schedule: "off",
  config: { playlistId, dryRun: false, prune: false },
  running,
  createdAt: 1,
});
const IDLE = { busy: false, unreachable: false };
const reasons = (plan: ReturnType<typeof planPlaylistBulk>) => plan.refused.map((item) => [item.id, item.reason]);

describe("the job behind each playlist", () => {
  it("prefers an enabled idle job, then an enabled running one, then a disabled one; a catalog job is no one's", () => {
    const catalog: AdminJob = { ...job(9, 0), type: "catalog", config: { scope: "trending", kind: "movie", pages: 5 } };
    const map = jobForPlaylists([job(1, 10, false), job(2, 10, true, true), job(3, 10), job(4, 20, false), catalog]);
    assert.deepEqual(map[10], { id: 3, enabled: true, running: false });
    assert.deepEqual(map[20], { id: 4, enabled: false, running: false });
    assert.equal(Object.keys(map).length, 2);
  });
});

describe("the Playlists bulk verbs", () => {
  const items = [row(1), row(2, false), row(3), row(4), row(5)];
  const jobFor = jobForPlaylists([job(11, 1), job(13, 3, false), job(14, 4, true, true)]);

  it("Sync now runs a playlist's own job and skips each other row with its reason", () => {
    const plan = planPlaylistBulk("sync", items, [1, 2, 3, 4, 5], jobFor);
    assert.deepEqual(plan.runnable.map((item) => item.id), [1]);
    assert.deepEqual(reasons(plan), [
      [2, "A disabled playlist cannot sync."],
      [3, "The job for this playlist is disabled."],
      [4, "That job is already running."],
      [5, "No job syncs this playlist; create one on the Jobs tab."],
    ]);
  });

  it("Enable and Disable skip a row already so; Delete skips nothing", () => {
    assert.deepEqual(reasons(planPlaylistBulk("enable", items, [1, 2], jobFor)), [[1, "Already enabled."]]);
    assert.deepEqual(reasons(planPlaylistBulk("disable", items, [1, 2], jobFor)), [[2, "Already disabled."]]);
    assert.deepEqual(planPlaylistBulk("delete", items, [1, 2], jobFor).runnable.length, 2);
  });

  it("is disabled with Tick a row first, Working., the unreachable sentence, then why nothing can run", () => {
    const none = planPlaylistBulk("sync", items, [], jobFor);
    assert.equal(playlistVerbReason("sync", none, 0, IDLE), "Tick a row first");
    const one = planPlaylistBulk("sync", items, [1], jobFor);
    assert.equal(playlistVerbReason("sync", one, 1, { busy: true, unreachable: false }), "Working.");
    const down = playlistVerbReason("sync", one, 1, { busy: false, unreachable: true });
    assert.equal(down, "The admin backend cannot be reached.");
    assert.equal(playlistVerbReason("sync", one, 1, IDLE), undefined);
    const skipped = planPlaylistBulk("sync", items, [5, 2], jobFor);
    assert.equal(playlistVerbReason("sync", skipped, 2, IDLE), "A disabled playlist cannot sync.");
    const enabled = planPlaylistBulk("enable", items, [1, 3], jobFor);
    assert.equal(playlistVerbReason("enable", enabled, 2, IDLE), "Every ticked playlist is already enabled.");
    const disabled = planPlaylistBulk("disable", items, [2], jobFor);
    assert.equal(playlistVerbReason("disable", disabled, 1, IDLE), "Every ticked playlist is already disabled.");
  });

  it("Delete's summary carries the sum of every released count", async () => {
    const tally = { released: 0 };
    const plan = planPlaylistBulk("delete", items, [1, 3, 4], jobFor);
    const answers: Record<number, number> = { 1: 6, 3: 8 };
    const outcome = await runBulk(plan, async (item) => {
      if (item.id === 4) return "That playlist does not exist.";
      tally.released += answers[item.id] ?? 0;
      return null;
    });
    assert.deepEqual(bulkSummary(deleteWords(tally), outcome), {
      sentence: "Deleted 2 playlists; 14 channels kept; 1 failed.",
      tone: "warn",
    });
    const single = { released: 1 };
    const once = await runBulk(planPlaylistBulk("delete", items, [1], jobFor), async () => null);
    assert.equal(bulkSummary(deleteWords(single), once).sentence, "Deleted 1 playlist; 1 channel kept.");
  });
});
