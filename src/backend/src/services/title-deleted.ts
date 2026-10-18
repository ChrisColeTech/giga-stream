import { AppError, ERRORS } from "../constants/errors.js";
import type { Store } from "../store/store.js";
import type { Actor, AuditService } from "./audit-service.js";
import { type Kind, parseTitleId, titleIdOf } from "./title-shapes.js";

/** A deleted synced title as `GET /api/titles/deleted` answers it (docs/03 section 7.4). */
export interface DeletedTitleView {
  id: string;
  kind: Kind;
  tmdbId: number;
  /** The last known title text; absent when none was kept. */
  title?: string;
  deletedAt: number;
}

/**
 * The deleted synced titles (docs/26 decision D20): what the admin may list and restore, and the one test the reads
 * and the sync use to skip a title. Restoring removes the record; the title returns on the next browse or sync.
 */
export function createTitleDeleted(deps: { store: Store; audit: AuditService }) {
  const { store, audit } = deps;
  const notFound = (titleId: string): AppError => new AppError(ERRORS.titleNotFound, { titleId });

  return {
    isDeleted: (kind: Kind, tmdbId: number): boolean => store.deletedTitles.has(kind, tmdbId),

    /** Rows of one kind without the deleted ones, and how many were left out. */
    withoutDeleted<T extends Record<string, unknown>>(kind: Kind, rows: T[]): { kept: T[]; skipped: number } {
      const kept = rows.filter((row) => typeof row.tmdbId !== "number" || !store.deletedTitles.has(kind, row.tmdbId));
      return { kept, skipped: rows.length - kept.length };
    },

    list(): { items: DeletedTitleView[] } {
      const items = store.deletedTitles.list().map((row) => ({
        id: titleIdOf(row.kind, row.tmdbId),
        kind: row.kind,
        tmdbId: row.tmdbId,
        ...(row.title !== undefined && { title: row.title }),
        deletedAt: row.deletedAt,
      }));
      return { items };
    },

    restore(titleId: string, actor: Actor): { id: string } {
      const [kind, tmdbId] = parseTitleId(titleId);
      const name = store.deletedTitles.list().find((row) => row.kind === kind && row.tmdbId === tmdbId)?.title;
      if (!store.deletedTitles.restore(kind, tmdbId)) throw notFound(titleId);
      audit.record(actor, { action: "title.restored", subject: titleId, detail: { name } });
      return { id: titleId };
    },
  };
}

export type TitleDeleted = ReturnType<typeof createTitleDeleted>;
