import { AppError, ERRORS } from "../constants/errors.js";
import type { Store } from "../store/store.js";
import type { AuditService } from "./audit-service.js";
import type { OmdbClient } from "./omdb-client.js";
import { createTitleDeleted } from "./title-deleted.js";
import { createTitleOverlay, viewOf } from "./title-overlay.js";
import { createTitleRecords, isManualId } from "./title-records.js";
import { createTitleSources } from "./title-sources.js";
import type { StreamTemplates } from "./stream-templates.js";
import type { TmdbClient } from "./tmdb-client.js";
import { createTitleReads } from "./title-reads.js";
import { createTitleSync } from "./title-sync.js";
import { asRecord, listOf, num, parseTitleId } from "./title-shapes.js";
import type { BrowseQuery, Kind, ListAnswer, SyncStatus } from "./title-shapes.js";

export { SORTS, type Kind, parseTitleId, titleIdOf, parseSchedule } from "./title-shapes.js";
export type { BrowseQuery, SyncRequest, SyncStatus } from "./title-shapes.js";

const notFound = (titleId: string): AppError => new AppError(ERRORS.titleNotFound, { titleId });

/** An admin's read passes `includeDisabled`; a public read leaves the disabled titles out. */
export interface ReadOptions {
  includeDisabled?: boolean;
}

/**
 * Titles (docs/03 sections 7.4, 7.6b; docs/26 decision D20): fill-through reads over the synced store, the
 * catalog sync - single-flight and audited; the backend's scheduler runs it through a job - and the records an admin
 * makes and edits. The two fills of section 7.5 are attached to detail and season answers as they are answered,
 * never stored: the providers' sources and the stream rule's `streamUrl`, neither displacing the other. Every
 * answer carries a `state` (synced, edited, manual), shows an admin's edits over TMDB's row, leaves out a disabled
 * title unless an admin asks, and lists the titles made by hand beside TMDB's.
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
  const reads = createTitleReads({ ...deps, deleted });
  const sync = createTitleSync({ ...deps, deleted });
  const sources = createTitleSources(store);
  const streams = deps.streams;
  const overlay = createTitleOverlay(store);
  const records = createTitleRecords({ ...deps, ensureTitle: reads.ensureTitle });

  /** TMDB's answer, or nothing when TMDB cannot be reached and there are titles made by hand to show instead. */
  async function tmdbPage(read: () => Promise<ListAnswer>, page: number, manual: number): Promise<ListAnswer> {
    try {
      return await read();
    } catch (error) {
      if (manual > 0 && error instanceof AppError && error.code === ERRORS.tmdbUnavailable.code) {
        return { items: [], page, totalPages: 1, totalResults: 0 };
      }
      throw error;
    }
  }

  /** A manual title, or 404 when it is not there or is disabled and the read is public. */
  function manualRow(titleId: string, options: ReadOptions) {
    const row = store.titles.findById(titleId);
    if (row?.origin !== "manual" || (!row.enabled && options.includeDisabled !== true)) throw notFound(titleId);
    return row;
  }

  /** A synced title is hidden from a public read while it is disabled. */
  function checkEnabled(titleId: string, options: ReadOptions): void {
    if (options.includeDisabled === true) return;
    if (store.titles.findById(titleId)?.enabled === false) throw notFound(titleId);
  }

  async function manualDetail(titleId: string, options: ReadOptions): Promise<Record<string, unknown>> {
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
    ensureTitle: reads.ensureTitle,
    genres: reads.genres,

    async browse(query: BrowseQuery, options: ReadOptions = {}): Promise<ListAnswer> {
      const manual = overlay.manualMatches({ ...query, ...options });
      const answer = await tmdbPage(() => reads.browse(query), query.page, manual.length);
      const items = overlay.decorate(answer.items, options.includeDisabled);
      return {
        ...answer,
        items: query.page === 1 ? overlay.merge(items, manual, query.sort) : items,
        totalResults: answer.totalResults + manual.length,
        skipped: (answer.skipped ?? 0) + answer.items.length - items.length,
      };
    },

    async search(kind: Kind, q: string, page: number, options: ReadOptions = {}): Promise<ListAnswer> {
      const manual = overlay.manualMatches({ kind, q, ...options });
      const answer = await tmdbPage(() => reads.search(kind, q, page), page, manual.length);
      const items = overlay.decorate(answer.items, options.includeDisabled);
      const skipped = (answer.skipped ?? 0) + answer.items.length - items.length;
      const total = answer.totalResults + manual.length;
      return { ...answer, items: page === 1 ? [...manual, ...items] : items, totalResults: total, skipped };
    },

    async detail(titleId: string, options: ReadOptions = {}): Promise<Record<string, unknown>> {
      if (isManualId(titleId)) return manualDetail(titleId, options);
      parseTitleId(titleId);
      checkEnabled(titleId, options);
      const answer = await reads.detail(titleId);
      const filled = streams.withDetail(sources.withDetail(answer));
      const row = store.titles.findById(titleId);
      if (row === undefined) return { ...filled, state: "synced" };
      const withEdits = overlay.decorate([filled], options.includeDisabled)[0] ?? filled;
      // An address the admin edited outranks the stream rule's.
      const own = row.editedFields.includes("streamUrl") ? asRecord(row.payload).streamUrl : undefined;
      return typeof own === "string" ? { ...withEdits, streamUrl: own } : withEdits;
    },

    async seasons(titleId: string, season: number, options: ReadOptions = {}): Promise<{ episodes: unknown[] }> {
      if (isManualId(titleId)) {
        const row = manualRow(titleId, options);
        const known = listOf(asRecord(row.payload).seasons).find((s) => num(asRecord(s).season) === season);
        const answer = { episodes: listOf(asRecord(known).episodes) };
        return row.tmdbId === null ? answer : sources.withEpisodes(answer, row.tmdbId);
      }
      const [, tmdbId] = parseTitleId(titleId);
      checkEnabled(titleId, options);
      const answer = await reads.seasons(titleId, season);
      return streams.withEpisodes(sources.withEpisodes(answer, tmdbId), tmdbId);
    },

    async recommendations(titleId: string, options: ReadOptions = {}): Promise<{ items: Record<string, unknown>[] }> {
      if (isManualId(titleId)) {
        manualRow(titleId, options);
        return { items: [] };
      }
      parseTitleId(titleId);
      checkEnabled(titleId, options);
      const answer = await reads.recommendations(titleId);
      return { items: overlay.decorate(answer.items, options.includeDisabled) };
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
