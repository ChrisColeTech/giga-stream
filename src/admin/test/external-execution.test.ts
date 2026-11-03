import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { createElement } from "react";
import { TitleStoredList } from "@/components/titles/TitleStoredList";
import { runGate, workspaceRunReason } from "@/lib/job-run-gate";
import { jobForPlaylists, planPlaylistBulk, syncSkip } from "@/lib/playlist-bulk";
import { syncPlan, syncReason } from "@/lib/title-sync";
import { JobsPage } from "@/pages/JobsPage";
import { PlaylistsPage } from "@/pages/PlaylistsPage";
import { JobSchema } from "@/services/schemas/job-schema";
import { useAppStore } from "@/store/app-store";
import { catalogJob, playlist, playlistJob } from "./support/run-kit";
import { renderLive, resetStore, signInForTest } from "./support/store";

const reason = "Sync execution is disabled on this API. Run and monitor catalog jobs in Cloud Run Jobs.";
const catalog = catalogJob(6, { executionDisabledReason: reason });
const linked = playlistJob(9, 1, { executionDisabledReason: reason });
const state = () => useAppStore.getState();

beforeEach(() => { resetStore(); signInForTest(); });

test("the optional reason is decoded strictly, never discarded to enable an unsafe action", () => {
  assert.equal(JobSchema.parse(catalog).executionDisabledReason, reason);
  assert.equal(JobSchema.parse(catalogJob(6)).executionDisabledReason, undefined);
  for (const value of [null, false, 42, "", "   ", { reason }]) {
    assert.equal(JobSchema.safeParse({ ...catalog, executionDisabledReason: value }).success, false);
  }
});

test("all run plans refuse external execution and inline jobs retain their existing gates", () => {
  assert.equal(runGate([catalog], [], false), reason);
  assert.equal(workspaceRunReason(catalog, { dirty: false, busy: false, unreachable: false, playlists: [] }), reason);
  assert.equal(runGate([catalogJob(6)], [], false), undefined);
  const links = jobForPlaylists([linked]);
  assert.equal(links[1]?.executionDisabledReason, reason);
  assert.equal(syncSkip(playlist(1), links[1]), reason);
  assert.deepEqual(planPlaylistBulk("sync", [playlist(1)], [1], links).runnable, []);
  assert.equal(syncReason({ jobs: [catalog], busy: false, syncing: 0, unreachable: false }), reason);
  assert.deepEqual(syncPlan([catalog]).runnable, []);
  assert.equal(syncPlan([catalog]).refused[0]?.reason, reason);
  assert.equal(syncPlan([catalogJob(6)]).runnable.length, 1);
});

function disabledControl(html: string, label: string): void {
  assert.ok(html.includes(`aria-label="${label}. ${reason}"`), "focusable disabled control exposes its reason");
  assert.ok(html.includes(`aria-label="${label}. ${reason}" role="group" tabindex="0"`),
    "the shared tooltip wrapper remains keyboard-focusable");
  assert.ok(!html.includes(`>${reason}<`), "no explanatory text under the control");
  assert.ok(html.includes("disabled=\"\""));
}

test("Jobs index and workspace keep Run job visibly disabled with the external tooltip", () => {
  state().jobsLoaded([catalog]);
  state().jobTick(6, true);
  disabledControl(renderLive(createElement(JobsPage, { active: true })), "Run job");
  state().openWorkspace("jobs", "6");
  disabledControl(renderLive(createElement(JobsPage, { active: true })), "Run job");
});

test("Library Sync now disables before a press, using the loaded job policy", () => {
  state().jobsLoaded([catalog]);
  disabledControl(renderLive(createElement(TitleStoredList)), "Sync now");
});

test("playlist index and workspace Sync now retain the policy through the job link", () => {
  state().playlistsLoaded([playlist(1)], jobForPlaylists([linked]));
  state().playlistTick(1, true);
  disabledControl(renderLive(createElement(PlaylistsPage, { active: true })), "Sync now");
  state().openWorkspace("playlists", "1");
  disabledControl(renderLive(createElement(PlaylistsPage, { active: true })), "Sync now");
});
