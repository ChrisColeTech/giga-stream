import { createCacheStateRepository } from "../store/cache-state-repository.js";
import { createCachedChannelRepository } from "../store/cached-channel-repository.js";
import { createCachedTitleQuery } from "../store/cached-title-query.js";
import { createCachedTitleRepository } from "../store/cached-title-repository.js";
import type { Database } from "../store/database.js";
import type { AdminCatalog } from "./admin-catalog.js";
import type { AdminClient } from "./admin-client.js";
import { createBackendCacheService } from "./backend-cache-service.js";
import { createChannelsSync } from "./channels-sync.js";
import { createTitlesSync } from "./titles-sync.js";

/**
 * The backend cache and the repositories its readers use (docs/46): the channels sync and the titles sync. One
 * place builds them so `app-services` stays small.
 */
export function createBackendCache(deps: {
  database: Database;
  admin: AdminClient;
  catalog: AdminCatalog;
  adminUrl: () => string;
  now: () => number;
}) {
  const state = createCacheStateRepository(deps.database);
  const channels = createCachedChannelRepository(deps.database);
  const titles = createCachedTitleRepository(deps.database);
  const titleQuery = createCachedTitleQuery(deps.database);
  const cache = createBackendCacheService({
    state,
    syncs: {
      channels: createChannelsSync({ admin: deps.admin, channels, state }),
      titles: createTitlesSync({ catalog: deps.catalog, titles, state }),
    },
    adminUrl: deps.adminUrl,
    now: deps.now,
  });
  return { cache, channels, titles, titleQuery };
}
