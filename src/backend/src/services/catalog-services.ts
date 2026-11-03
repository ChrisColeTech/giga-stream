import type { Store } from "../store/store.js";
import { createAuditService } from "./audit-service.js";
import { createOmdbClient } from "./omdb-client.js";
import type { ServiceOptions } from "./service-registry.js";
import { createStreamTemplates } from "./stream-templates.js";
import { createTitleService } from "./title-service.js";
import { createTmdbClient } from "./tmdb-client.js";

/** Shared catalog composition for the API and the headless worker; no startup work or timers. */
export function createCatalogServices(
  store: Store, options: ServiceOptions, scheduleLabel: () => Promise<string>, executionDisabledReason?: string,
) {
  const { now } = options;
  const audit = createAuditService(store, now);
  const tmdb = createTmdbClient({ token: options.tmdbToken, base: options.tmdbBase, now, minGapMs: options.tmdbMinGapMs });
  const omdb = createOmdbClient({ key: options.omdbKey, base: options.omdbBase, dailyLimit: options.omdbDailyLimit, now });
  const streams = createStreamTemplates({
    movieTemplate: options.movieStreamTemplate, episodeTemplate: options.episodeStreamTemplate,
  });
  const titles = createTitleService({ store, audit, tmdb, omdb, streams, now, scheduleLabel, executionDisabledReason });
  return { audit, tmdb, omdb, titles };
}
