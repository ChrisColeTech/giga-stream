import { AppError, ERRORS } from "../constants/errors.js";
import type { ProviderRecord } from "../store/provider-repository.js";
import type { Store } from "../store/store.js";
import type { BackendProvider, ProviderInput, ProviderList, ProviderPatch } from "../types/provider.js";
import type { Actor, AuditService } from "./audit-service.js";

const invalid = (field: string, message: string): AppError =>
  new AppError(ERRORS.providerInvalid, { field }, message);

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
      api_key: input.api_key ?? null,
      is_active: 1,
      created_at: createdAt,
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
      api_key: patch.api_key ?? current.api_key ?? null,
      is_active: current.is_active ? 1 : 0,
      created_at: current.created_at,
    };
      store.transaction(() => {
        store.providers.update(record);
        store.revisions.next();
      });
      audit.record(actor, { action: "provider.updated", subject: String(id), detail: { fields: Object.keys(patch) } });
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
