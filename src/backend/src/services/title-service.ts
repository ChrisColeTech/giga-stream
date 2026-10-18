import { AppError, ERRORS } from "../constants/errors.js";
import type { Store } from "../store/store.js";
import type { AuditService } from "./audit-service.js";
import type { OmdbClient } from "./omdb-client.js";
import { createDetailFetch } from "./title-detail-fetch.js";
import { createTitleDeleted } from "./title-deleted.js";
import { viewOf } from "./title-overlay.js";
import { createTitleRecords, isManualId } from "./title-records.js";
import { createTitleSources } from "./title-sources.js";
import type { StreamTemplates } from "./stream-templates.js";
import type { TmdbClient } from "./tmdb-client.js";
import { createTitleReads } from "./title-reads.js";
import { createTitleSync } from "./title-sync.js";
import { createTmdbBrowse } from "./title-tmdb-browse.js";
import { asRecord, listOf, num, parseTitleId } from "./title-shapes.js";
import type { Kind, SyncStatus } from "./title-shapes.js";

export { SORTS, type Kind, parseTitleId, titleIdOf, parseSchedule } from "./title-shapes.js";
export type { BrowseQuery, SyncRequest, SyncStatus } from "./title-shapes.js";

const notFound = (titleId: string): AppError => new AppError(ERRORS.titleNotFound, { titleId });

/** An admin's read passes `includeDisabled`; a public read leaves the disabled titles out. */
export interface ReadOptions {
  includeDisabled?: boolean;
}

/**
 * Titles (docs/03 sections 7.4, 7.6b; docs/47): store-only reads - what the Library fill synced and what an admin made,
 * never a call to TMDB - the Library fill itself (single-flight and audited; the backend's scheduler runs it through a
 * job), Browse TMDB (the admin's own read of TMDB, which writes nothing) and the records an admin makes and edits. The
 * two fills of section 7.5 are attached to detail and season answers as they are answered, never stored: the providers'
 * sources and the stream rule's `streamUrl`, neither displacing the other. Every answer carries a `state` (synced,
 * edited, manual), shows an admin's edits, and leaves out a disabled title unless an admin asks.
 */
export function createTitleService(deps: {
  store: Store;
  audit: AuditService;
  tmdb: TmdbClient;
  omdb: OmdbClient;
  streams: StreamTemplates;
  now: () => number;
  /** The schedule shown in the sync status: the first enabled catalog job's. */
  scheduleLabel?: () => string;
}) {
  const { store } = deps;
  const deleted = createTitleDeleted(deps);
  const reads = createTitleReads(store);
  const sync = createTitleSync({ ...deps, deleted });
  const sources = createTitleSources(store);
  const streams = deps.streams;
  const records = createTitleRecords({ ...deps, deleted, fetchDetail: createDetailFetch(deps) });
  const tmdbBrowse = createTmdbBrowse(deps);

  /** A manual title, or 404 when it is not there or is disabled and the read is public. */
  function manualRow(titleId: string, options: ReadOptions) {
    const row = store.titles.findById(titleId);
    if (row?.origin !== "manual" || (!row.enabled && options.includeDisabled !== true)) throw notFound(titleId);
    return row;
  }

  function manualDetail(titleId: string, options: ReadOptions): Record<string, unknown> {
    const row = manualRow(titleId, options);
    const view = viewOf(row, options.includeDisabled === true);
    const filled = row.tmdbId === null ? view : sources.withDetail({ ...view, tmdbId: row.tmdbId });
    // The admin's own address wins; the stream rule only fills a manual title that has none.
    return typeof view.streamUrl === "string" || row.tmdbId === null ? filled : streams.withDetail(filled);
  }

  return {
    ...records,
    listDeleted: deleted.list,
    restore: deleted.restore,
    runNow: sync.runNow,
    isSyncRunning: sync.isRunning,
    genres: (kind: Kind) => reads.genres(kind),
    browseTmdb: tmdbBrowse.browse,
    searchTmdb: tmdbBrowse.search,

    detail(titleId: string, options: ReadOptions = {}): Record<string, unknown> {
      if (isManualId(titleId)) return manualDetail(titleId, options);
      const answer = reads.detail(titleId, options.includeDisabled === true);
      const filled = streams.withDetail(sources.withDetail(answer));
      // An address the admin edited outranks the stream rule's.
      const row = reads.find(titleId, options.includeDisabled === true).row;
      const own = row.editedFields.includes("streamUrl") ? asRecord(row.payload).streamUrl : undefined;
      return typeof own === "string" ? { ...filled, streamUrl: own } : filled;
    },

    seasons(titleId: string, season: number, options: ReadOptions = {}): { episodes: unknown[] } {
      if (isManualId(titleId)) {
        const row = manualRow(titleId, options);
        const known = listOf(asRecord(row.payload).seasons).find((s) => num(asRecord(s).season) === season);
        const answer = { episodes: listOf(asRecord(known).episodes) };
        return row.tmdbId === null ? answer : sources.withEpisodes(answer, row.tmdbId);
      }
      const [, tmdbId] = parseTitleId(titleId);
      const answer = reads.episodes(titleId, season, options.includeDisabled === true);
      return streams.withEpisodes(sources.withEpisodes(answer, tmdbId), tmdbId);
    },

    recommendations(titleId: string, options: ReadOptions = {}): { items: Record<string, unknown>[] } {
      if (isManualId(titleId)) {
        manualRow(titleId, options);
        return { items: [] };
      }
      return reads.recommendations(titleId, options.includeDisabled === true);
    },

    status(): SyncStatus {
      return { ...sync.status(), schedule: deps.scheduleLabel?.() ?? "off" };
    },
    close(): void {
      sync.stop();
    },
  };
}

export type TitleService = ReturnType<typeof createTitleService>;
