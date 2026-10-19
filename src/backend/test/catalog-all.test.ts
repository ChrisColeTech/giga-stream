// Trending and Popular All (docs/56 decision 7): movie then TV, the configured pages for each kind, and one combined
// monotonic progress/count range.
import assert from "node:assert/strict";
import test from "node:test";

import { createTitleWalk } from "../src/services/title-walk.js";
import type { ProgressUpdate } from "../src/types/job-progress.js";

for (const scope of ["trending", "popular"] as const) {
  test(`${scope} All walks movie then TV with pages per kind and combined progress`, async () => {
    const calls: string[] = [];
    const reports: ProgressUpdate[] = [];
    const walk = createTitleWalk({
      store: { transaction: (work) => work() },
      tmdb: {
        get: async <T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> => {
          calls.push(`${path}?page=${String(params?.page)}`);
          return { total_pages: 2, results: [{ id: calls.length, title: "Title", name: "Series" }] } as T;
        },
      },
      storeRow: () => true,
      now: () => 0,
    });
    const seen = { titles: 0, detailed: 0, seasons: 0, enriched: 0, airing: 0 };
    await walk({ scope, kind: "all", pages: 2 }, {
      signal: new AbortController().signal,
      report: (update) => void reports.push(update),
      seen,
      shuttingDown: () => false,
    });
    const prefix = scope === "trending" ? "/trending/" : "/";
    const suffix = scope === "trending" ? "/week" : "/popular";
    assert.deepEqual(calls, [
      `${prefix}movie${suffix}?page=1`, `${prefix}movie${suffix}?page=2`,
      `${prefix}tv${suffix}?page=1`, `${prefix}tv${suffix}?page=2`,
    ]);
    assert.equal(seen.titles, 4);
    assert.deepEqual(reports.map(({ done, total }) => [done, total]), [
      [0, 4], [1, 4], [2, 4], [2, 4], [3, 4], [4, 4],
    ]);
    assert.deepEqual(reports.map((report) => report.done), [...reports.map((report) => report.done)].sort((a, b) => a - b));
  });
}
