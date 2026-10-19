import { pruneProviderTicks, sortedProviders, upsertProvider, withoutProvider } from "@/lib/provider-rows";
import type { AdminProvider } from "@/services/schemas/provider-schema";
import type { SliceGet, SliceSet } from "./slices/slice-host";

/* The Providers tab's data, a slice of the one store (`37` section 5). Facts only: no promise, no timer. The flows
 * (`services/provider-flows.ts`) read the backend and hand the answers to these setters. `unreachable` is set by a
 * transport failure and cleared by the next successful read; while it is set every write is disabled with the
 * unreachable sentence. `session` is the sign-in serial the data belongs to: the session slice does not reset this
 * slice on sign-out, so the load hook resets it when a new session starts (`providersReset`). */

export type ProvidersStatus = "idle" | "loading" | "ready" | "failed";

/** The provider preview window's request value (`55` decision 7), the channels preview's own shape: the provider the
 *  opener held, a serial raised at every open (so the window re-reads and its choice resets) and the open this window
 *  is, the remount key that keeps its body through its exit fade. */
export interface ProviderPreview {
  readonly providerId: number;
  readonly serial: number;
  readonly opened: number;
}

export interface ProvidersState {
  readonly status: ProvidersStatus;
  readonly items: readonly AdminProvider[];
  readonly unreachable: boolean;
  readonly ticked: readonly number[];
  readonly session: number;
  readonly preview: ProviderPreview | null;
}

export const NO_PROVIDERS: ProvidersState = {
  status: "idle",
  items: [],
  unreachable: false,
  ticked: [],
  session: 0,
  preview: null,
};

export interface ProvidersSlice {
  providers: ProvidersState;
  /** A new session: back to nothing read, owned by `session`. */
  providersReset: (session: number) => void;
  providersStartLoad: () => void;
  /** A list read answered: it replaces the items, clears `unreachable` and drops the ticks of rows that are gone. */
  providersLoaded: (items: readonly AdminProvider[]) => void;
  /** A list read failed: the last items stay. */
  providersLoadFailed: (unreachable: boolean) => void;
  providerUpsert: (provider: AdminProvider) => void;
  providerRemove: (id: number) => void;
  providerTick: (id: number, on: boolean) => void;
  providersTickAll: (on: boolean) => void;
  /** Leaves exactly these ids ticked (a bulk run unticks the rows it finished). */
  providersSetTicked: (ids: readonly number[]) => void;
  providersMarkUnreachable: (unreachable: boolean) => void;
  /** `Preview` (the row's eye, the workspace's `Preview →`): the window's request value, its serial raised. The caller
   *  opens the overlay. */
  providersOpenPreview: (providerId: number) => void;
  providersClosePreview: () => void;
}

export function createProvidersSlice(set: SliceSet<ProvidersSlice>, get: SliceGet<ProvidersSlice>): ProvidersSlice {
  const patch = (next: Partial<ProvidersState>): void => set({ providers: { ...get().providers, ...next } });
  const withItems = (items: readonly AdminProvider[]): Partial<ProvidersState> => ({
    items,
    ticked: pruneProviderTicks(get().providers.ticked, items),
  });
  return {
    providers: NO_PROVIDERS,
    providersReset: (session) => set({ providers: { ...NO_PROVIDERS, session } }),
    providersStartLoad: () => patch({ status: "loading" }),
    providersLoaded: (items) => patch({ status: "ready", unreachable: false, ...withItems(sortedProviders(items)) }),
    providersLoadFailed: (unreachable) => patch({ status: "failed", unreachable }),
    providerUpsert: (provider) => patch(withItems(upsertProvider(get().providers.items, provider))),
    providerRemove: (id) => patch(withItems(withoutProvider(get().providers.items, id))),
    providerTick: (id, on) => {
      const rest = get().providers.ticked.filter((one) => one !== id);
      patch({ ticked: on ? [...rest, id] : rest });
    },
    providersTickAll: (on) => patch({ ticked: on ? get().providers.items.map((item) => item.id) : [] }),
    providersSetTicked: (ids) => patch({ ticked: pruneProviderTicks(ids, get().providers.items) }),
    providersMarkUnreachable: (unreachable) => patch({ unreachable }),
    providersOpenPreview: (providerId) => {
      const serial = (get().providers.preview?.serial ?? 0) + 1;
      patch({ preview: { providerId, serial, opened: serial } });
    },
    providersClosePreview: () => patch({ preview: null }),
  };
}
