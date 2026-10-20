import type { AdminFailure } from "../services/admin-failure.js";

/** The datasets the fileserver keeps from the backend (docs/46 section A). */
export type CacheDataset = "channels" | "titles";

export const CACHE_DATASETS: readonly CacheDataset[] = ["channels", "titles"];

/** One `cache_state` row (docs/46 section B). `syncedAt` null = never completed a sync. */
export interface CacheStateRow {
  dataset: CacheDataset;
  sourceKey: string;
  syncedAt: number | null;
  attemptedAt: number | null;
  errorCode: string | null;
  revision: number | null;
  run: number;
}

/** What a finished sync stamps (the channels sync fills the revision; the titles sync leaves it out). */
export interface SyncStamp {
  sourceKey: string;
  syncedAt: number;
  revision: number | null;
}

/** One `cached_channels` row, in the backend's order (`position`). */
export interface CachedChannelRow {
  id: string;
  position: number;
  name: string;
  number?: string;
  category: string;
  logoUrl?: string;
  streamUrl: string;
  revision: number;
}

export type SyncOutcome = { ok: true } | { ok: false; failure: AdminFailure };

/** What a dataset's sync gets from the cache service. */
export interface SyncContext {
  baseUrl: string;
  sourceKey: string;
  /** When the sync began: the `synced_at` it stamps. */
  startedAt: number;
  /** Aborts on quit or on a change of backend. */
  signal: AbortSignal;
}

export type DatasetSync = (context: SyncContext) => Promise<SyncOutcome>;
