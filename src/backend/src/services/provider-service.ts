import { AppError, ERRORS } from "../constants/errors.js";
import type { ProviderRecord } from "../store/provider-repository.js";
import type { Store } from "../store/store.js";
import type { BackendProvider, ProviderInput, ProviderList, ProviderPatch } from "../types/provider.js";
import type { Actor, AuditService } from "./audit-service.js";

/** The template and message fields a written row carries, from the input or its defaults. */
function fieldsOf(input: {
  order?: number;
  family?: "embed" | "stream";
  movieTemplate?: string;
  episodeTemplate?: string;
  startParam?: string;
  subtitlesParam?: string;
  origin?: string;
  frameOrigins?: string[];
  messageShape?: "vidsrc-status" | "player-event";
}): Omit<ProviderRecord, "id" | "name" | "source" | "is_active" | "created_at"> {
  return {
    order: input.order ?? 0,
    family: input.family ?? "embed",
    movie_template: input.movieTemplate ?? null,
    episode_template: input.episodeTemplate ?? null,
    start_param: input.startParam ?? null,
    subtitles_param: input.subtitlesParam ?? null,
    origin: input.origin ?? null,
    frame_origins: input.frameOrigins ? JSON.stringify(input.frameOrigins) : null,
    message_shape: input.messageShape ?? null,
  };
}

/**
 * A PATCH's optional field: absent keeps the stored value, `null` clears it (docs/29 B2), a value replaces it.
 */
function kept<T>(patched: T | null | undefined, stored: T | undefined): T | undefined {
  if (patched === undefined) return stored;
  return patched ?? undefined;
}

/**
 * The providers (docs/03 section 7.2b). Every change is live as soon as it is saved: it raises the one
 * revision in the same transaction. Nothing is pushed: a reader learns of a change from the revision in the next
 * answer it reads (`01` section 4.4).
 */
export function createProviderService(deps: {
  store: Store;
  audit: AuditService;
  now: () => number;
}) {
  const { store, audit, now } = deps;

  function existing(id: number): BackendProvider {
    const found = store.providers.find(id);
    if (!found) throw new AppError(ERRORS.providerNotFound);
    return found;
  }

  return {
    list(): ProviderList {
      return { items: store.providers.list() };
    },

    get: (id: number): BackendProvider => existing(id),

    create(input: ProviderInput, actor: Actor): BackendProvider {
      const createdAt = new Date(now()).toISOString();
      const record: Omit<ProviderRecord, "id"> = {
        name: input.name,
        source: input.source,
        is_active: (input.enabled ?? true) ? 1 : 0,
        created_at: createdAt,
        ...fieldsOf(input),
      };
      const id = store.transaction(() => {
        const newId = store.providers.insert(record);
        store.revisions.next();
        return newId;
      });
      audit.record(actor, { action: "provider.created", subject: String(id), detail: { name: input.name, source: input.source } });
      return existing(id);
    },

    update(id: number, patch: ProviderPatch, actor: Actor): BackendProvider {
      const current = existing(id);
      const record: ProviderRecord = {
        id,
        name: patch.name ?? current.name,
        source: patch.source ?? current.source,
        is_active: (patch.enabled ?? current.is_active) ? 1 : 0,
        created_at: current.created_at,
        ...fieldsOf({
          order: patch.order ?? current.order,
          family: patch.family ?? current.family,
          movieTemplate: kept(patch.movieTemplate, current.movieTemplate),
          episodeTemplate: kept(patch.episodeTemplate, current.episodeTemplate),
          startParam: kept(patch.startParam, current.startParam),
          subtitlesParam: kept(patch.subtitlesParam, current.subtitlesParam),
          origin: kept(patch.origin, current.origin),
          frameOrigins: kept(patch.frameOrigins, current.frameOrigins),
          messageShape: kept(patch.messageShape, current.messageShape),
        }),
      };
      store.transaction(() => {
        store.providers.update(record);
        store.revisions.next();
      });
      audit.record(actor, {
        action: "provider.updated",
        subject: String(id),
        detail: { name: record.name, fields: Object.keys(patch) },
      });
      return existing(id);
    },

    remove(id: number, actor: Actor): { id: number } {
      const current = existing(id);
      store.transaction(() => {
        store.providers.remove(id);
        store.revisions.next();
      });
      audit.record(actor, { action: "provider.deleted", subject: String(id), detail: { name: current.name } });
      return { id };
    },

    isEmpty: (): boolean => store.providers.isEmpty(),
  };
}

export type ProviderService = ReturnType<typeof createProviderService>;
