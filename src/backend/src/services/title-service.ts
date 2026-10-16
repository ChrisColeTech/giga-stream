import type { Store } from "../store/store.js";
import type { EventSink } from "../types/events.js";
import type { Actor, AuditService } from "./audit-service.js";
import type { OmdbClient } from "./omdb-client.js";
import type { TmdbClient } from "./tmdb-client.js";
import { createTitleReads } from "./title-reads.js";
import { createTitleSync } from "./title-sync.js";
import type { SyncStatus } from "./title-shapes.js";

export { SORTS, type Kind, parseTitleId, titleIdOf, parseSchedule } from "./title-shapes.js";
export type { BrowseQuery, SyncRequest, SyncStatus } from "./title-shapes.js";

/**
 * Titles (docs/03 sections 7.4, 7.6b): fill-through reads over the synced store, and the catalog-sync
 * job — one at a time, audited, announced, and the system's only scheduled timer (`01` section 4.4).
 */
export function createTitleService(deps: {
  store: Store;
  events: EventSink;
  audit: AuditService;
  tmdb: TmdbClient;
  omdb: OmdbClient;
  now: () => number;
}) {
  const reads = createTitleReads(deps);
  const sync = createTitleSync({ ...deps, ensureTitle: reads.ensureTitle });

  return {
    ...reads,
    ...sync,
    status(): SyncStatus {
      return sync.status();
    },
    close(): void {
      sync.clearSchedule();
    },
  };
}

export type TitleService = ReturnType<typeof createTitleService>;
