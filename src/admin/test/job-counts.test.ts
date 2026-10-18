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

  it("words the Library fill's details and seasons from the typed counts, tolerating the fields a result lacks", () => {
    assert.equal(
      runWords("ok", { titles: 10923, detailed: 10901, seasons: 31204, stale: 0 }),
      "Synced: 10,923 titles, 10,901 details, 31,204 seasons.",
    );
    assert.equal(runWords("ok", { titles: 5, detailed: 0, seasons: 0, stale: 2 }), "Synced: 5 titles, 2 stale.");
    assert.equal(
      runWords("ok", { titles: 9, detailed: 8, seasons: 3, enriched: 7, stale: 0 }),
      "Synced: 9 titles, 8 details, 3 seasons, 7 enriched.",
    );
    assert.equal(runWords("stopped", { titles: 4, detailed: 1, stale: 0, stopped: true }), "Stopped: 4 titles, 1 details.");
  });

  it("words the Library update's airing series between the titles and the details, and leaves out zero", () => {
    assert.equal(
      runWords("ok", { titles: 4, airing: 29, detailed: 31, seasons: 0, stale: 0 }),
      "Synced: 4 titles, 29 airing, 31 details.",
    );
    assert.equal(runWords("ok", { titles: 4, airing: 0, detailed: 0, stale: 0 }), "Synced: 4 titles.");
    assert.equal(runWords("ok", { titles: 4, stale: 0 }), "Synced: 4 titles.", "a result stored before the update has no airing");
  });

  it("reads a catalog result with the new counts, an unknown extra field, or none of them", () => {
    const read = (lastCounts: unknown) => JobSchema.parse({ ...job(1, 1), type: "catalog", lastResult: "ok", lastCounts }).lastCounts;
    const full = catalogCountsOf(read({ titles: 3, detailed: 2, seasons: 9, stale: 0, later: 1 }));
    assert.deepEqual([full?.detailed, full?.seasons, full?.enriched], [2, 9, undefined]);
    assert.equal(catalogCountsOf(read({ titles: 3, stale: 1 }))?.detailed, undefined);
    assert.equal(catalogCountsOf(read({ titles: 3, airing: 2, stale: 1 }))?.airing, 2);
    assert.equal(catalogCountsOf(read({ titles: 3, detailed: "many", stale: 1 })), undefined);
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
