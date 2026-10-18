import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { catalogCounts, countsLine, playlistCounts } from "@/lib/job-counts";
import { lastRunFailed } from "@/lib/job-rows";
import type { AdminJob } from "@/services/schemas/job-schema";

const job = (lastCounts?: Record<string, unknown>, extra: Partial<AdminJob> = {}): AdminJob => ({
  id: 1,
  name: "Job",
  type: "playlist",
  enabled: true,
  schedule: "off",
  config: { playlistId: 1, dryRun: false, prune: false },
  running: false,
  createdAt: 1,
  ...(lastCounts !== undefined && { lastCounts }),
  ...extra,
});

describe("reading lastCounts defensively", () => {
  it("keeps the counts that are numbers, in the page's order, and drops the odd ones", () => {
    const read = playlistCounts(job({ created: 3, updated: 12, kept: "x", skipped: -1, refused: 2, removed: null }));
    assert.deepEqual(read.counts, { created: 3, updated: 12, refused: 2 });
    assert.equal(countsLine(read.counts), "3 created · 12 updated · 2 refused");
  });

  it("reads absent counts, examples and ids as undefined: the page draws a shimmer line", () => {
    const read = playlistCounts(job());
    assert.deepEqual([read.counts, read.refused, read.created], [{}, undefined, undefined]);
    assert.equal(countsLine(read.counts), undefined);
    assert.equal(playlistCounts(job({ refusalExamples: "not a list" })).refused, undefined);
  });

  it("keeps at most ten string examples and ids", () => {
    const many = Array.from({ length: 14 }, (_, index) => `ch_${index}`);
    const read = playlistCounts(job({ refusalExamples: ["bad address", 7, "no name"], createdIds: many }));
    assert.deepEqual(read.refused, ["bad address", "no name"]);
    assert.equal(read.created?.length, 10);
  });

  it("reads a catalog job's titles and stale counts, each present or not", () => {
    assert.deepEqual(catalogCounts(job({ titles: 1240 })), { titles: 1240, stale: undefined });
    assert.deepEqual(catalogCounts(job({ titles: 3, stale: 1 })), { titles: 3, stale: 1 });
  });
});

describe("a failed last run", () => {
  it("is a playlist run that kept a sentence and no counts, or a catalog run whose outcome is not ok", () => {
    assert.equal(lastRunFailed(job()), false, "never ran");
    assert.equal(lastRunFailed(job(undefined, { lastRunAt: 5, lastOutcome: "unreachable" })), true);
    const synced = { lastRunAt: 5, lastOutcome: "Synced: 1 created, 0 updated." };
    assert.equal(lastRunFailed(job({ created: 1 }, synced)), false);
    const catalog: Partial<AdminJob> = { type: "catalog", config: { scope: "trending", kind: "movie", pages: 5 } };
    assert.equal(lastRunFailed(job({ titles: 0 }, { ...catalog, lastRunAt: 5, lastOutcome: "ok" })), false);
    assert.equal(lastRunFailed(job({ titles: 0 }, { ...catalog, lastRunAt: 5, lastOutcome: "TMDB down" })), true);
  });
});
