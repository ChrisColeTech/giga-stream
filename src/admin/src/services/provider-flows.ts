import { AUDIT_AFTER_WRITE, AUDIT_PAGE } from "@/constants/audit-limits";
import {
  PROVIDER_GONE,
  providerCreated,
  providerDeleted,
  providerSaved,
  unreadableProviders,
} from "@/constants/provider-copy";
import { isEmptyBody, providerChanges, providerCreateBody } from "@/lib/provider-body";
import { firstCreateRefusal, firstSaveRefusal, providerFieldOf, type ProviderField } from "@/lib/provider-checks";
import type { NewProviderDraft, ProviderDraft } from "@/lib/provider-draft";
import { findProvider } from "@/lib/provider-rows";
import type { AppState } from "@/store/app-store";
import {
  DROPPED,
  codeOf,
  done,
  refusalOf,
  type FlowRefused,
  type FlowResult,
  type RefusalPorts,
} from "./provider-flow-support";
import type { ProvidersService } from "./providers";
import type { AdminProvider } from "./schemas/provider-schema";

/** The part of the store the provider flows read and write. `useAppStore.getState` satisfies it; a test passes the same. */
export type ProviderStore = Pick<
  AppState,
  | "serial"
  | "signedIn"
  | "providers"
  | "workspaces"
  | "providersStartLoad"
  | "providersLoaded"
  | "providersLoadFailed"
  | "providerUpsert"
  | "providerRemove"
  | "providersMarkUnreachable"
  | "closeWorkspace"
  | "say"
>;

export interface ProviderFlowDeps {
  readonly service: Pick<ProvidersService, "list" | "create" | "update" | "remove">;
  readonly store: () => ProviderStore;
  /** Reads the audit tail again (`limit` entries); never rejects. */
  readonly audit: { readonly reload: (limit?: number) => Promise<void> };
}

export type ProviderResult<T = undefined> = FlowResult<T, ProviderField>;

export interface ProviderFlows {
  load: () => Promise<ProviderResult>;
  /** The list and the audit tail, read together (the list's Refresh). */
  refresh: () => Promise<ProviderResult>;
  create: (draft: NewProviderDraft) => Promise<ProviderResult>;
  /** Null when nothing changed; the saved provider otherwise. */
  save: (id: number, draft: ProviderDraft) => Promise<ProviderResult<AdminProvider | null>>;
  remove: (id: number) => Promise<ProviderResult>;
}

const BAD_ANSWER = "backend.bad_response";
const NOT_FOUND = "provider.not_found";

/** The Providers tab's orchestration (`37` sections 3.2 and 3.3). Each flow records the session's serial before it
 *  awaits and writes only if the session is unchanged after (`serial` guard); a failure is said once as a `warn` notice
 *  and returned typed, so the form can put a field's refusal under its row. */
export function createProviderFlows(deps: ProviderFlowDeps): ProviderFlows {
  const { service, store, audit } = deps;
  const alive = (serial: number): boolean => store().signedIn && store().serial === serial;
  const ports: RefusalPorts<ProviderField> = {
    say: (sentence, tone, area) => store().say(sentence, tone, area),
    markUnreachable: () => store().providersMarkUnreachable(true),
    area: "Provider",
    fieldOf: providerFieldOf,
  };
  const rejected = (sentence: string, field?: ProviderField): FlowRefused<ProviderField> => {
    store().say(sentence, "warn", "Provider");
    return { ok: false, sentence, ...(field !== undefined && { field }) };
  };

  async function load(): Promise<ProviderResult> {
    if (store().providers.status === "loading") return done(undefined);
    const serial = store().serial;
    store().providersStartLoad();
    try {
      const list = await service.list();
      if (!alive(serial)) return DROPPED;
      store().providersLoaded(list.items);
      if (list.unreadable > 0) store().say(unreadableProviders(list.unreadable), "warn", "Provider");
      return done(undefined);
    } catch (error: unknown) {
      if (!alive(serial)) return DROPPED;
      store().providersLoadFailed(codeOf(error) === "backend.unreachable");
      return refusalOf(ports, error);
    }
  }

  /** A write whose answer could not be read may still have happened, and a provider that is gone is gone: re-read. */
  const afterFailure = (error: unknown): FlowRefused<ProviderField> => {
    const result = refusalOf(ports, error);
    const code = codeOf(error);
    if (code === BAD_ANSWER || code === NOT_FOUND) void load();
    return result;
  };

  function gone(): FlowRefused<ProviderField> {
    store().closeWorkspace("providers");
    return rejected(PROVIDER_GONE);
  }

  async function create(draft: NewProviderDraft): Promise<ProviderResult> {
    const bad = firstCreateRefusal(draft);
    if (bad !== null) return rejected(bad.sentence, bad.field);
    const serial = store().serial;
    try {
      const provider = await service.create(providerCreateBody(draft));
      if (!alive(serial)) return DROPPED;
      store().providerUpsert(provider);
      store().say(providerCreated(provider.name));
      void audit.reload(AUDIT_AFTER_WRITE);
      return done(undefined);
    } catch (error: unknown) {
      return alive(serial) ? afterFailure(error) : DROPPED;
    }
  }

  async function save(id: number, draft: ProviderDraft): Promise<ProviderResult<AdminProvider | null>> {
    const saved = findProvider(store().providers.items, id);
    if (saved === undefined) return gone();
    const bad = firstSaveRefusal(draft);
    if (bad !== null) return rejected(bad.sentence, bad.field);
    const body = providerChanges(saved, draft);
    if (isEmptyBody(body)) return done(null);
    const serial = store().serial;
    try {
      const provider = await service.update(id, body);
      if (!alive(serial)) return DROPPED;
      store().providerUpsert(provider);
      store().say(providerSaved(provider.name));
      void audit.reload(AUDIT_AFTER_WRITE);
      return done(provider);
    } catch (error: unknown) {
      if (!alive(serial)) return DROPPED;
      if (codeOf(error) === NOT_FOUND) store().closeWorkspace("providers");
      return afterFailure(error);
    }
  }

  async function remove(id: number): Promise<ProviderResult> {
    const provider = findProvider(store().providers.items, id);
    if (provider === undefined) return gone();
    const serial = store().serial;
    try {
      await service.remove(id);
      if (!alive(serial)) return DROPPED;
      store().providerRemove(id);
      if (store().workspaces.providers === String(id)) store().closeWorkspace("providers");
      store().say(providerDeleted(provider.name));
      void audit.reload(AUDIT_AFTER_WRITE);
      return done(undefined);
    } catch (error: unknown) {
      return alive(serial) ? afterFailure(error) : DROPPED;
    }
  }

  const refresh = async (): Promise<ProviderResult> => {
    const [result] = await Promise.all([load(), audit.reload(AUDIT_PAGE)]);
    return result;
  };

  return { load, refresh, create, save, remove };
}
