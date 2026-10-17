import type { Store } from "../store/store.js";
import type { Actor, AuditService } from "./audit-service.js";
import type { OmdbClient } from "./omdb-client.js";
import { createTitleSources } from "./title-sources.js";
import type { StreamTemplates } from "./stream-templates.js";
import type { TmdbClient } from "./tmdb-client.js";
import { createTitleReads } from "./title-reads.js";
import { createTitleSync } from "./title-sync.js";
import { parseTitleId } from "./title-shapes.js";
import type { SyncStatus } from "./title-shapes.js";

export { SORTS, type Kind, parseTitleId, titleIdOf, parseSchedule } from "./title-shapes.js";
export type { BrowseQuery, SyncRequest, SyncStatus } from "./title-shapes.js";

/**
 * Titles (docs/03 sections 7.4, 7.6b): fill-through reads over the synced store, and the catalog-sync
 * job - one at a time, audited, and one of the backend's two scheduled timers (`01` section 4.4) -
 * with the two fills of section 7.5, attached to detail and season answers as they are answered, never
 * stored: the providers' sources and the stream rule's `streamUrl`, neither displacing the other.
 */
export function createTitleService(deps: {
  store: Store;
  audit: AuditService;
  tmdb: TmdbClient;
  omdb: OmdbClient;
  streams: StreamTemplates;
  now: () => number;
}) {
  const reads = createTitleReads(deps);
  const sync = createTitleSync({ ...deps, ensureTitle: reads.ensureTitle });
  const sources = createTitleSources(deps.store);
  const streams = deps.streams;

  return {
    ...reads,
    ...sync,
    async detail(titleId: string): Promise<Record<string, unknown>> {
      const answer = await reads.detail(titleId);
      return streams.withDetail(sources.withDetail(answer));
    },
    async seasons(titleId: string, season: number): Promise<{ episodes: unknown[] }> {
      const [, tmdbId] = parseTitleId(titleId);
      const answer = await reads.seasons(titleId, season);
      return streams.withEpisodes(sources.withEpisodes(answer, tmdbId), tmdbId);
    },
    status(): SyncStatus {
      return sync.status();
    },
    close(): void {
      sync.clearSchedule();
    },
  };
}

export type TitleService = ReturnType<typeof createTitleService>;
