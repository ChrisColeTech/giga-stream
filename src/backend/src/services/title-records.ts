import { randomUUID } from "node:crypto";

import { AppError, ERRORS } from "../constants/errors.js";
import type { Store } from "../store/store.js";
import { applyFields } from "../store/title-edits.js";
import type { StoredTitle } from "../store/title-repository.js";
import type { SeasonInput, TitleInput, TitlePatch } from "../types/title-input.js";
import { addressRefusal, isAcceptedAddress } from "./address-rule.js";
import type { Actor, AuditService } from "./audit-service.js";
import { viewOf } from "./title-overlay.js";
import { type Kind, asRecord, mapTitle404, parseTitleId, str } from "./title-shapes.js";

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
 * disabled title leaves the public reads and no sync ever changes it. Deleting is a real delete, so a later sync or
 * read may add a synced title again. Titles are not channel data, so none of this touches the revision.
 */
export function createTitleRecords(deps: {
  store: Store;
  audit: AuditService;
  ensureTitle: (kind: Kind, tmdbId: number, force?: boolean) => Promise<Record<string, unknown>>;
  now: () => number;
  allowLoopback: boolean;
}) {
  const { store, audit, ensureTitle, now, allowLoopback } = deps;

  function checkAddresses(values: Record<string, unknown>): void {
    for (const field of ["posterUrl", "backdropUrl", "streamUrl"] as const) {
      const value = values[field];
      if (typeof value === "string" && !isAcceptedAddress(value, allowLoopback)) {
        throw invalid(field, addressRefusal(field, allowLoopback));
      }
    }
    const seasons = Array.isArray(values.seasons) ? values.seasons : [];
    for (const season of seasons as Array<{ episodes: Array<{ stillUrl?: string; streamUrl?: string }> }>) {
      for (const episode of season.episodes) {
        for (const field of ["stillUrl", "streamUrl"] as const) {
          const value = episode[field];
          if (value !== undefined && !isAcceptedAddress(value, allowLoopback)) {
            throw invalid("seasons", addressRefusal(`episode ${field}`, allowLoopback));
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

  /** A synced title that is not stored yet (listed from TMDB, never opened) is fetched once so it can be edited. */
  async function foundOrFetch(titleId: string): Promise<StoredTitle> {
    const row = store.titles.findById(titleId);
    if (row !== undefined || isManualId(titleId)) return found(titleId);
    const [kind, tmdbId] = parseTitleId(titleId);
    try {
      await ensureTitle(kind, tmdbId);
    } catch (error) {
      return mapTitle404(error, titleId);
    }
    return found(titleId);
  }

  return {
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
      const row = await foundOrFetch(titleId);
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

    /** A real delete. A synced title may come back with a later sync or read; `enabled` is how to keep it hidden. */
    remove(titleId: string, actor: Actor): { id: string } {
      const row = found(titleId);
      store.titles.remove(titleId);
      audit.record(actor, { action: "title.deleted", subject: titleId, detail: { origin: row.origin } });
      return { id: titleId };
    },

    /** Drops an admin's edits and takes TMDB's record again; a title made by hand has nothing to go back to. */
    async revert(titleId: string, actor: Actor): Promise<Record<string, unknown>> {
      const row = found(titleId);
      if (row.origin === "manual" || row.tmdbId === null) throw new AppError(ERRORS.titleManual, { titleId });
      store.titles.clearEdits(titleId);
      try {
        await ensureTitle(row.kind, row.tmdbId, true);
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
