import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runGate, workspaceRunReason } from "@/lib/job-run-gate";
import type { AdminJob } from "@/services/schemas/job-schema";
import { catalogJob, playlist as playlistRow, playlistJob } from "./support/run-kit";

const job = (id: number, extra: Partial<AdminJob> = {}): AdminJob => playlistJob(id, id, { name: `Job ${id}`, ...extra });
const playlist = (id: number, enabled = true) => playlistRow(id, { enabled, channels: 0 });
const PLAYLISTS = [playlist(1), playlist(2, false)];

describe("the Run job gate", () => {
  it("gives its reasons in priority order: none ticked, disabled, running, playlist disabled, unreachable", () => {
    assert.equal(runGate([], PLAYLISTS, true), "Tick a job first");
    const all = [job(1, { enabled: false }), job(1, { running: true }), job(2)];
    assert.equal(runGate(all, PLAYLISTS, true), "Jobs that are disabled cannot run.");
    assert.equal(runGate(all.slice(1), PLAYLISTS, true), "A ticked job is already running.");
    assert.equal(runGate(all.slice(2), PLAYLISTS, true), "A ticked job's playlist is disabled.");
    assert.equal(runGate([job(1)], PLAYLISTS, true), "The admin backend cannot be reached.");
    assert.equal(runGate([job(1)], PLAYLISTS, false), undefined);
  });

  it("finds a job's playlist by its id, then by its name; a catalog job has none", () => {
    const renamed = job(7, { config: { playlistId: 2 }, playlistId: 2 });
    assert.equal(runGate([renamed], PLAYLISTS, false), "A ticked job's playlist is disabled.");
    const byName = job(8, { config: { playlistId: 9 }, playlistId: undefined, playlistName: "List 2" });
    assert.equal(runGate([byName], PLAYLISTS, false), "A ticked job's playlist is disabled.");
    assert.equal(runGate([catalogJob(9)], PLAYLISTS, false), undefined);
  });

  it("asks the workspace to save first, then says Running., before the toolbar's reasons", () => {
    const state = { dirty: true, busy: true, unreachable: false, playlists: PLAYLISTS };
    assert.equal(workspaceRunReason(job(1), state), "Save the job first");
    assert.equal(workspaceRunReason(job(1), { ...state, dirty: false }), "Running.");
    const clean = { ...state, dirty: false, busy: false };
    assert.equal(workspaceRunReason(job(2), clean), "A ticked job's playlist is disabled.");
    assert.equal(workspaceRunReason(job(1), clean), undefined);
  });
});
