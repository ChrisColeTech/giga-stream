import type { CachedChannelRepository } from "../store/cached-channel-repository.js";
import type { ChannelList, ChannelSummary } from "../types/channel.js";
import type { CachedChannelRow } from "../types/backend-cache.js";
import { badResponse, unreachable, type AdminFailure } from "./admin-failure.js";
import type { BackendCacheService } from "./backend-cache-service.js";

/** The backend's facts for the state answer (docs/03 section 4): derived from the cache's last attempt. */
export interface BackendState {
  url: string;
  connected: boolean;
  revision?: number;
  readAt?: number;
  error?: { code: string; message: string };
}

export interface LiveViewRead {
  list: ChannelList;
  backend: BackendState;
}

const KNOWN_FAILURES: readonly AdminFailure[] = [unreachable, badResponse];

/**
 * The live channels (docs/03 section 3.4, docs/46 section D.2): a thin read of the cached channels. A read
 * checks freshness first (`ensureFresh`) and never fails on a sync failure; `refresh` forces the sync and
 * carries the failure for its 503/502 answer.
 */
export function createLiveChannelsService(deps: {
  cache: BackendCacheService;
  channels: CachedChannelRepository;
  adminUrl: () => string;
  /**
   * Every image address the fileserver passes on is rewritten to the image cache (03 section 3.11): a
   * channel's logo becomes `/api/images/<imageId>`. A source that fails the address rule is returned unchanged.
   */
  rewriteImageUrl: (source: string) => string;
}) {
  const { cache, channels, adminUrl, rewriteImageUrl } = deps;

  function summaryOf(row: CachedChannelRow): ChannelSummary {
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      revision: row.revision,
      streamUrl: row.streamUrl,
      ...(row.logoUrl !== undefined && { logoUrl: rewriteImageUrl(row.logoUrl) }),
      ...(row.number !== undefined && { number: row.number }),
    };
  }

  function backend(): BackendState {
    const row = cache.rowOf("channels");
    const code = row?.errorCode ?? undefined;
    return {
      url: adminUrl(),
      connected: row !== undefined && row.syncedAt !== null && code === undefined,
      ...(row?.revision != null && row.revision !== 0 && { revision: row.revision }),
      ...(row?.syncedAt != null && { readAt: row.syncedAt }),
      ...(code !== undefined && {
        error: { code, message: KNOWN_FAILURES.find((one) => one.code === code)?.message ?? badResponse.message },
      }),
    };
  }

  function read(query: { q?: string; category?: string }): LiveViewRead {
    return {
      list: {
        items: channels.list(query).map(summaryOf),
        categories: channels.categories(),
        revision: cache.rowOf("channels")?.revision ?? 0,
      },
      backend: backend(),
    };
  }

  return {
    /** `GET /api/channels`: the matching cached channels. `awaitCold: false` (the state answer) never waits. */
    async list(query: { q?: string; category?: string }, options: { awaitCold?: boolean } = {}): Promise<LiveViewRead> {
      await cache.ensureFresh("channels", options);
      return read(query);
    },
    /** `POST /api/channels/refresh`: force a sync and answer from the cache it left. */
    async refresh(): Promise<LiveViewRead | { failure: AdminFailure }> {
      const outcome = await cache.refresh("channels");
      return outcome.ok ? read({}) : { failure: outcome.failure };
    },
    /** The last channel, reported only while the cache holds it (docs/03 section 3.4). */
    lastId(fromStore: () => string | undefined): string | undefined {
      const stored = fromStore();
      return stored !== undefined && channels.has(stored) ? stored : undefined;
    },
    /** Whether a channel is in the cache (after a freshness check). */
    async knows(id: string): Promise<boolean> {
      await cache.ensureFresh("channels");
      return channels.has(id);
    },
    backend,
  };
}

export type LiveChannelsService = ReturnType<typeof createLiveChannelsService>;
