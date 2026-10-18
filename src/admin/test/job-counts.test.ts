import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { catalogCountsOf, countsLine, failedCountsOf, playlistCountsOf, refusalsOf } from "@/lib/job-counts";
import { lastRunFailed } from "@/lib/job-rows";
import { runWords } from "@/lib/run-words";
import { JobSchema } from "@/services/schemas/job-schema";
import { counts, playlistJob as job } from "./support/run-kit";

describe("the typed counts of a last run", () => {
  it("narrows lastCounts by its shape: playlist, catalog or failed", () => {
    const playlist = counts({ created: 3 });
    assert.equal(playlistCountsOf(playlist)?.created, 3);
    assert.equal(playlistCountsOf({ titles: 1, stale: 0 }), undefined);
    assert.equal(catalogCountsOf({ titles: 1240, stale: 3 })?.titles, 1240);
    assert.equal(failedCountsOf({ code: "playlist.unreachable" })?.code, "playlist.unreachable");
    assert.equal(playlistCountsOf(undefined), undefined);
  });

  it("words the Counts line from the four counts a file import leaves, never inventing one", () => {
    assert.equal(countsLine(counts({ created: 3, updated: 12, refused: 2 })), "3 created · 12 updated · 0 skipped · 2 refused");
  });

  it("keeps at most ten refusal examples", () => {
    const many = Array.from({ length: 14 }, (_, index) => `Entry ${index}`);
    assert.equal(refusalsOf(counts({ refused: 14, refusalExamples: many })).length, 10);
  });

  it("reads an unreadable result or counts as absent, so the row still reads", () => {
    const row = JobSchema.safeParse({ ...job(1, 1), lastResult: "exploded", lastCounts: { created: "many" } });
    assert.ok(row.success);
    assert.deepEqual([row.data.lastResult, row.data.lastCounts], [undefined, undefined]);
  });
});

describe("a run worded in the admin from its typed result", () => {
  it("says nothing before a first run", () => {
    assert.equal(runWords(undefined, undefined), undefined);
  });

  it("words only what the run counted: the W2 shape and a run that changed nothing", () => {
    assert.equal(
      runWords("ok", counts({ source: "updated", logosCached: 312, live: 1904, dead: 640 })),
      "Synced: 312 logos cached, 1,904 live, 640 dead.",
    );
    assert.equal(runWords("ok", counts()), "Synced: nothing changed.");
    assert.equal(runWords("ok", counts({ created: 2, updated: 1 })), "Synced: 2 created, 1 updated.");
    assert.equal(runWords("ok", { titles: 1240, stale: 0 }), "Synced: 1,240 titles.");
  });

  it("says a stopped run and an unreachable web list, and a failure by its code", () => {
    assert.equal(runWords("stopped", counts({ created: 1, stopped: true })), "Stopped: 1 created.");
    assert.equal(runWords("ok", counts({ source: "unreachable" })), "Synced: web list unreachable.");
    assert.equal(runWords("failed", { code: "playlist.unreachable" }), "Failed: A playlist cannot be reached right now.");
    assert.equal(runWords("failed", { code: "something.odd" }), "Failed: something.odd");
  });
});

describe("a failed last run", () => {
  it("is the backend's own failed result, never inferred from a missing field", () => {
    assert.equal(lastRunFailed(job(1, 1)), false, "never ran");
    assert.equal(lastRunFailed(job(1, 1, { lastRunAt: 5, lastResult: "failed", lastCounts: { code: "x.y" } })), true);
    assert.equal(lastRunFailed(job(1, 1, { lastRunAt: 5, lastResult: "ok", lastCounts: counts() })), false);
    assert.equal(lastRunFailed(job(1, 1, { lastRunAt: 5, lastResult: "stopped" })), false);
    assert.equal(lastRunFailed(job(1, 1, { lastRunAt: 5 })), false, "a run with no result is not a failure");
  });
});
