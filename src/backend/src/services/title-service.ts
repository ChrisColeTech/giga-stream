import { AppError, ERRORS } from "../constants/errors.js";
import type { Store } from "../store/store.js";
import type { AuditService } from "./audit-service.js";
import type { OmdbClient } from "./omdb-client.js";
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

/**
 * Titles (docs/03 sections 7.4, 7.6b; docs/26 decision D20): fill-through reads over the synced store, the
 * catalog-sync job - one at a time, audited, and one of the backend's two scheduled timers (`01` section 4.4) -
 * and the records an admin makes and edits. The two fills of section 7.5 are attached to detail and season
 * answers as they are answered, never stored: the providers' sources and the stream rule's `streamUrl`,
 * neither displacing the other. Every answer carries a `state` (synced, edited, manual), shows an admin's edits
 * over TMDB's row, leaves out a title an admin deleted, and lists the titles made by hand beside TMDB's.
 */
export function createTitleService(deps: {
  store: Store;
  audit: AuditService;
  tmdb: TmdbClient;
  omdb: OmdbClient;
  streams: StreamTemplates;
  now: () => number;
  allowLoopback: boolean;
  /** The stored schedule setting, shown in the sync status. */
  scheduleLabel?: () => string;
}) {
  const { store } = deps;
  const reads = createTitleReads(deps);
  const sync = createTitleSync({ ...deps, ensureTitle: reads.ensureTitle });
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

  async function manualDetail(titleId: string): Promise<Record<string, unknown>> {
    const row = store.titles.findById(titleId);
    if (row?.origin !== "manual") throw notFound(titleId);
    const view = viewOf(row);
    const filled = row.tmdbId === null ? view : sources.withDetail({ ...view, tmdbId: row.tmdbId });
    // The admin's own address wins; the stream rule only fills a manual title that has none.
    return typeof view.streamUrl === "string" || row.tmdbId === null ? filled : streams.withDetail(filled);
  }

  return {
    ...sync,
    ...records,
    ensureTitle: reads.ensureTitle,
    genres: reads.genres,

    async browse(query: BrowseQuery): Promise<ListAnswer> {
      const manual = overlay.manualMatches(query);
      const answer = await tmdbPage(() => reads.browse(query), query.page, manual.length);
      const items = overlay.decorate(answer.items);
      return {
        ...answer,
        items: query.page === 1 ? overlay.merge(items, manual, query.sort) : items,
        totalResults: answer.totalResults + manual.length,
      };
    },

    async search(kind: Kind, q: string, page: number): Promise<ListAnswer> {
      const manual = overlay.manualMatches({ kind, q });
      const answer = await tmdbPage(() => reads.search(kind, q, page), page, manual.length);
      const items = overlay.decorate(answer.items);
      return { ...answer, items: page === 1 ? [...manual, ...items] : items, totalResults: answer.totalResults + manual.length };
    },

    async detail(titleId: string): Promise<Record<string, unknown>> {
      if (isManualId(titleId)) return manualDetail(titleId);
      const [kind, tmdbId] = parseTitleId(titleId);
      if (store.titles.isDeleted(kind, tmdbId)) throw notFound(titleId);
      const answer = await reads.detail(titleId);
      const filled = streams.withDetail(sources.withDetail(answer));
      const row = store.titles.findById(titleId);
      if (row === undefined) return { ...filled, state: "synced" };
      const withEdits = overlay.decorate([filled])[0] ?? filled;
      // An address the admin edited outranks the stream rule's.
      const own = row.editedFields.includes("streamUrl") ? asRecord(row.payload).streamUrl : undefined;
      return typeof own === "string" ? { ...withEdits, streamUrl: own } : withEdits;
    },

    async seasons(titleId: string, season: number): Promise<{ episodes: unknown[] }> {
      if (isManualId(titleId)) {
        const row = store.titles.findById(titleId);
        if (row?.origin !== "manual") throw notFound(titleId);
        const known = listOf(asRecord(row.payload).seasons).find((s) => num(asRecord(s).season) === season);
        const answer = { episodes: listOf(asRecord(known).episodes) };
        return row.tmdbId === null ? answer : sources.withEpisodes(answer, row.tmdbId);
      }
      const [kind, tmdbId] = parseTitleId(titleId);
      if (store.titles.isDeleted(kind, tmdbId)) throw notFound(titleId);
      const answer = await reads.seasons(titleId, season);
      return streams.withEpisodes(sources.withEpisodes(answer, tmdbId), tmdbId);
    },

    async recommendations(titleId: string): Promise<{ items: Record<string, unknown>[] }> {
      if (isManualId(titleId)) {
        if (store.titles.findById(titleId)?.origin !== "manual") throw notFound(titleId);
        return { items: [] };
      }
      const [kind, tmdbId] = parseTitleId(titleId);
      if (store.titles.isDeleted(kind, tmdbId)) throw notFound(titleId);
      const answer = await reads.recommendations(titleId);
      return { items: overlay.decorate(answer.items) };
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
