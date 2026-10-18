import { createCacheStateRepository } from "../store/cache-state-repository.js";
import { createCachedChannelRepository } from "../store/cached-channel-repository.js";
import type { Database } from "../store/database.js";
import type { AdminClient } from "./admin-client.js";
import { createBackendCacheService } from "./backend-cache-service.js";
import { createChannelsSync } from "./channels-sync.js";

/**
 * The backend cache and the repositories its readers use (docs/46): the channels sync now; the titles sync
 * joins `syncs` in a later wave. One place builds them so `app-services` stays small.
 */
export function createBackendCache(deps: {
  database: Database;
  admin: AdminClient;
  adminUrl: () => string;
  now: () => number;
}) {
  const state = createCacheStateRepository(deps.database);
  const channels = createCachedChannelRepository(deps.database);
  const cache = createBackendCacheService({
    state,
    syncs: { channels: createChannelsSync({ admin: deps.admin, channels, state }) },
    adminUrl: deps.adminUrl,
    now: deps.now,
  });
  return { cache, channels };
}
