import { randomUUID } from "node:crypto";

import { AppError, ERRORS } from "../constants/errors.js";
import type { Store } from "../store/store.js";
import { applyFields } from "../store/title-edits.js";
import type { StoredTitle } from "../store/title-repository.js";
import type { SeasonInput, TitleInput, TitlePatch } from "../types/title-input.js";
import { addressRefusal, isAcceptedAddress } from "./address-rule.js";
import type { Actor, AuditService } from "./audit-service.js";
import { viewOf } from "./title-overlay.js";
import type { DetailFetch } from "./title-detail-fetch.js";
import type { TitleDeleted } from "./title-deleted.js";
import { asRecord, mapTitle404, parseTitleId, str } from "./title-shapes.js";

const MANUAL_PREFIX = "custom-";
export const isManualId = (titleId: string): boolean => titleId.startsWith(MANUAL_PREFIX);

const invalid = (field: string, message: string): AppError => new AppError(ERRORS.titleInvalid, { field }, message);

/** A title's name as the audit log names it (docs/29 B5). */
const nameOf = (row: StoredTitle): string | undefined => str(asRecord(row.payload).title);

/** A manual series' seasons as the detail and season routes answer them: every episode knows its season. */
const seasonsOf = (seasons: SeasonInput[]): unknown[] =>
  seasons.map((s) => ({ season: s.season, episodes: s.episodes.map((e) => ({ ...e, season: s.season })) }));

/**
 * The title records (docs/26 decision D20): create, edit, delete and revert. A title made by hand (`custom-<uuid>`)
 * is the admin's alone; a synced one records the fields an admin edited (`edited_fields`), which the store keeps
 * every later sync, fill-through and healing refetch from overwriting. `enabled` is a field of the record: a
 * disabled title leaves the public reads and no sync ever changes it. Deleting a synced title records it as deleted
 * (`title-deleted.ts` lists and restores those). Titles are not channel data, so none of this touches the revision.
 */
export function createTitleRecords(deps: {
  store: Store;
  audit: AuditService;
  fetchDetail: DetailFetch;
  deleted: TitleDeleted;
  now: () => number;
}) {
  const { store, audit, fetchDetail, deleted, now } = deps;

  function checkAddresses(values: Record<string, unknown>): void {
    for (const field of ["posterUrl", "backdropUrl", "streamUrl"] as const) {
      const value = values[field];
      if (typeof value === "string" && !isAcceptedAddress(value)) {
        throw invalid(field, addressRefusal(field));
      }
    }
    const seasons = Array.isArray(values.seasons) ? values.seasons : [];
    for (const season of seasons as Array<{ episodes: Array<{ stillUrl?: string; streamUrl?: string }> }>) {
      for (const episode of season.episodes) {
        for (const field of ["stillUrl", "streamUrl"] as const) {
          const value = episode[field];
          if (value !== undefined && !isAcceptedAddress(value)) {
            throw invalid("seasons", addressRefusal(`episode ${field}`));
          }
        }
      }
    }
  }

  const found = (titleId: string): StoredTitle => {
    const row = store.titles.findById(titleId);
    if (row === undefined) throw new AppError(ERRORS.titleNotFound, { titleId });
    return row;
  };

  return {
    /**
     * The explicit add (docs/47 section 3.3): ONE title's detail is fetched from TMDB and stored, from the admin's
     * Browse TMDB. `409 title.taken` when it is already stored or was deleted (restore it instead).
     */
    async addFromTmdb(titleId: string, actor: Actor): Promise<Record<string, unknown>> {
      const [kind, tmdbId] = parseTitleId(titleId);
      if (store.titles.find(kind, tmdbId) !== undefined || deleted.isDeleted(kind, tmdbId)) {
        throw new AppError(ERRORS.titleTaken, { titleId, deleted: deleted.isDeleted(kind, tmdbId) });
      }
      try {
        await fetchDetail(kind, tmdbId, { force: true });
      } catch (error) {
        return mapTitle404(error, titleId);
      }
      const saved = found(titleId);
      audit.record(actor, { action: "title.created", subject: titleId, detail: { title: nameOf(saved), kind, source: "tmdb" } });
      return viewOf(saved);
    },

    create(input: TitleInput, actor: Actor): Record<string, unknown> {
      const { kind, tmdbId, seasons, ...fields } = input;
      checkAddresses({ ...fields, seasons });
      const id = `${MANUAL_PREFIX}${randomUUID()}`;
      const payload: Record<string, unknown> = {
        id, kind, shape: "detail", ...fields, ...(tmdbId !== undefined && { tmdbId }),
        ...(seasons !== undefined && { seasons: seasonsOf(seasons) }),
      };
      store.titles.insertManual({ id, kind, tmdbId: tmdbId ?? null, payload, at: now() });
      audit.record(actor, { action: "title.created", subject: id, detail: { title: input.title, kind } });
      return viewOf(found(id));
    },

    async update(titleId: string, patch: TitlePatch, actor: Actor): Promise<Record<string, unknown>> {
      const row = found(titleId);
      if (row.origin === "tmdb" && patch.tmdbId !== undefined) {
        throw invalid("tmdbId", "A title from TMDB keeps its TMDB id.");
      }
      const { tmdbId, seasons, enabled, ...rest } = patch;
      const values: Record<string, unknown> = {
        ...rest,
        ...(seasons !== undefined && { seasons: seasons === null ? null : seasonsOf(seasons) }),
      };
      checkAddresses({ ...values, seasons: seasons ?? undefined });
      // A null clears the field; an absent field is untouched.
      const wanted = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined).map(([k, v]) => [k, v ?? undefined]));
      const fields = Object.keys(values).filter((k) => values[k] !== undefined);
      const before = row.payload as Record<string, unknown>;
      const changed = fields.filter((f) => JSON.stringify(before[f]) !== JSON.stringify(wanted[f]));
      const payload = applyFields(row.payload, wanted, fields);
      const editedFields = row.origin === "tmdb" ? [...new Set([...row.editedFields, ...changed])] : [];
      const nextTmdbId = row.origin === "manual" && tmdbId !== undefined ? tmdbId : row.tmdbId;
      if (row.origin === "manual") {
        if (tmdbId === null) delete payload.tmdbId;
        else if (tmdbId !== undefined) payload.tmdbId = tmdbId;
      }
      store.titles.updateRecord(titleId, { payload, editedFields, tmdbId: nextTmdbId, enabled: enabled ?? row.enabled });
      const touched = [...fields, ...(tmdbId === undefined ? [] : ["tmdbId"]), ...(enabled === undefined ? [] : ["enabled"])];
      const saved = found(titleId);
      const detail = { name: nameOf(saved), fields: touched };
      audit.record(actor, { action: "title.updated", subject: titleId, detail });
      return viewOf(saved);
    },

    /**
     * A title made by hand is deleted for real. A synced one is deleted and stays deleted: its TMDB identity is
     * recorded (migration 020), so the browse, search, detail and the sync skip it until it is restored.
     */
    remove(titleId: string, actor: Actor): { id: string } {
      const row = found(titleId);
      store.transaction(() => {
        store.titles.remove(titleId);
        if (row.origin === "tmdb" && row.tmdbId !== null) {
          store.deletedTitles.record(row.kind, row.tmdbId, nameOf(row), now());
        }
      });
      audit.record(actor, { action: "title.deleted", subject: titleId, detail: { origin: row.origin } });
      return { id: titleId };
    },

    /** Drops an admin's edits and takes TMDB's record again; a title made by hand has nothing to go back to. */
    async revert(titleId: string, actor: Actor): Promise<Record<string, unknown>> {
      const row = found(titleId);
      if (row.origin === "manual" || row.tmdbId === null) throw new AppError(ERRORS.titleManual, { titleId });
      store.titles.clearEdits(titleId);
      try {
        await fetchDetail(row.kind, row.tmdbId, { force: true });
      } catch (error) {
        // The refetch failed: the edits were not given up.
        store.titles.updateRecord(titleId, { payload: row.payload, editedFields: row.editedFields, tmdbId: row.tmdbId, enabled: row.enabled });
        return mapTitle404(error, titleId);
      }
      const saved = found(titleId);
      const detail = { name: nameOf(saved), fields: row.editedFields };
      audit.record(actor, { action: "title.reverted", subject: titleId, detail });
      return viewOf(saved);
    },
  };
}

export type TitleRecords = ReturnType<typeof createTitleRecords>;
