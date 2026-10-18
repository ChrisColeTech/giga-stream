import assert from "node:assert/strict";
import test from "node:test";

import { CACHE_RETRY_GAP_MS, CACHE_WINDOW_MS } from "../src/constants/backend-cache.js";
import { isDue, sourceKeyOf } from "../src/services/cache-freshness.js";
import type { CacheStateRow } from "../src/types/backend-cache.js";

const NOW = Date.UTC(2026, 9, 18, 12);
const MINUTE = 60_000;
const KEY = sourceKeyOf("http://127.0.0.1:8091");

function row(change: Partial<CacheStateRow> = {}): CacheStateRow {
  return {
    dataset: "channels",
    sourceKey: KEY,
    syncedAt: NOW - MINUTE,
    attemptedAt: NOW - MINUTE,
    errorCode: null,
    revision: 3,
    run: 0,
    ...change,
  };
}

interface Case {
  name: string;
  state: CacheStateRow | undefined;
  manual?: boolean;
  due: boolean;
}

const CASES: Case[] = [
  { name: "no row at all (never synced)", state: undefined, due: true },
  { name: "a row that never completed a sync", state: row({ syncedAt: null }), due: true },
  { name: "synced a minute ago", state: row(), due: false },
  { name: "5 h 59 min old", state: row({ syncedAt: NOW - (CACHE_WINDOW_MS - MINUTE) }), due: false },
  { name: "one millisecond short of 6 h", state: row({ syncedAt: NOW - CACHE_WINDOW_MS + 1 }), due: false },
  { name: "exactly 6 h old", state: row({ syncedAt: NOW - CACHE_WINDOW_MS }), due: true },
  { name: "older than 6 h", state: row({ syncedAt: NOW - 2 * CACHE_WINDOW_MS }), due: true },
  { name: "the clock moved back (synced in the future)", state: row({ syncedAt: NOW + MINUTE }), due: true },
  { name: "a different backend, fresh", state: row({ sourceKey: sourceKeyOf("http://other.test") }), due: true },
  {
    name: "a failed attempt 4 min ago on an old cache: inside the retry gap",
    state: row({ syncedAt: NOW - 7 * 60 * MINUTE, attemptedAt: NOW - 4 * MINUTE, errorCode: "backend.unreachable" }),
    due: false,
  },
  {
    name: "a failed attempt exactly at the retry gap",
    state: row({
      syncedAt: NOW - 7 * 60 * MINUTE,
      attemptedAt: NOW - CACHE_RETRY_GAP_MS,
      errorCode: "backend.unreachable",
    }),
    due: true,
  },
  {
    name: "a manual refresh ignores the retry gap",
    state: row({ syncedAt: NOW - 7 * 60 * MINUTE, attemptedAt: NOW - MINUTE, errorCode: "backend.unreachable" }),
    manual: true,
    due: true,
  },
  {
    name: "a cold dataset that just failed waits out the gap",
    state: row({ syncedAt: null, attemptedAt: NOW - MINUTE, errorCode: "backend.bad_response" }),
    due: false,
  },
  {
    name: "a failure stamped in the future does not hold the gap",
    state: row({ syncedAt: null, attemptedAt: NOW + MINUTE, errorCode: "backend.unreachable" }),
    due: true,
  },
  {
    name: "a different backend ignores the gap of the old one",
    state: row({ sourceKey: sourceKeyOf("http://other.test"), attemptedAt: NOW - MINUTE, errorCode: "backend.unreachable" }),
    due: true,
  },
];

for (const one of CASES) {
  test(`due rule: ${one.name}`, () => {
    assert.equal(isDue(one.state, { now: NOW, sourceKey: KEY, manual: one.manual === true }), one.due);
  });
}

test("a source key is 16 hex digits and names the address", () => {
  assert.match(KEY, /^[0-9a-f]{16}$/);
  assert.notEqual(KEY, sourceKeyOf("http://127.0.0.1:8191"));
  assert.equal(KEY, sourceKeyOf("http://127.0.0.1:8091"));
});
