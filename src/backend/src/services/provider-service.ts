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

  async function existing(id: number): Promise<BackendProvider> {
    const found = await store.providers.find(id);
    if (!found) throw new AppError(ERRORS.providerNotFound);
    return found;
  }

  return {
    list: async (): Promise<ProviderList> => ({ items: await store.providers.list() }),

    get: async (id: number): Promise<BackendProvider> => existing(id),

    create: async (input: ProviderInput, actor: Actor): Promise<BackendProvider> => {
      const createdAt = new Date(now()).toISOString();
      const record: Omit<ProviderRecord, "id"> = {
        name: input.name,
        source: input.source,
        is_active: (input.enabled ?? true) ? 1 : 0,
        created_at: createdAt,
        ...fieldsOf(input),
      };
      const id = await store.transaction(async () => {
        const newId = await store.providers.insert(record);
        await store.revisions.next();
        return newId;
      });
      await audit.record(actor, { action: "provider.created", subject: String(id), detail: { name: input.name, source: input.source } });
      return existing(id);
    },

    update: async (id: number, patch: ProviderPatch, actor: Actor): Promise<BackendProvider> => {
      const current = await existing(id);
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
      await store.transaction(async () => {
        await store.providers.update(record);
        await store.revisions.next();
      });
      await audit.record(actor, {
        action: "provider.updated",
        subject: String(id),
        detail: { name: record.name, fields: Object.keys(patch) },
      });
      return existing(id);
    },

    remove: async (id: number, actor: Actor): Promise<{ id: number }> => {
      const current = await existing(id);
      await store.transaction(async () => {
        await store.providers.remove(id);
        await store.revisions.next();
      });
      await audit.record(actor, { action: "provider.deleted", subject: String(id), detail: { name: current.name } });
      return { id };
    },

    isEmpty: (): Promise<boolean> => store.providers.isEmpty(),
  };
}

export type ProviderService = ReturnType<typeof createProviderService>;
