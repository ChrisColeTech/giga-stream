import { createHash } from "node:crypto";

import { CACHE_RETRY_GAP_MS, CACHE_WINDOW_MS, SOURCE_KEY_LENGTH } from "../constants/backend-cache.js";
import type { CacheStateRow } from "../types/backend-cache.js";

/** Names one backend: the first hex digits of the sha256 of its normalized address (docs/46 section B). */
export function sourceKeyOf(adminUrl: string): string {
  return createHash("sha256").update(adminUrl).digest("hex").slice(0, SOURCE_KEY_LENGTH);
}

/**
 * Whether a dataset is due for a sync (docs/46 section C; docs/03 section 5.1). Pure: the caller passes the
 * clock. Due when there is no row, the backend differs, it never synced, a full window has passed, or the clock
 * moved back. After a failed attempt it is not due again until the retry gap has passed, unless `manual`; a
 * different backend is always due, because the old attempt said nothing about it.
 */
export function isDue(state: CacheStateRow | undefined, input: { now: number; sourceKey: string; manual?: boolean }): boolean {
  if (state === undefined || state.sourceKey !== input.sourceKey) return true;
  const failed = state.errorCode !== null && state.attemptedAt !== null;
  if (failed && input.manual !== true) {
    const since = input.now - (state.attemptedAt ?? 0);
    if (since >= 0 && since < CACHE_RETRY_GAP_MS) return false;
  }
  if (state.syncedAt === null) return true;
  return state.syncedAt > input.now || input.now - state.syncedAt >= CACHE_WINDOW_MS;
}
