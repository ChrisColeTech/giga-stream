import type { SettingsAnswer, SettingsPatch } from "./schemas/settings-schema";
import type { ClearedWatch, RemovedWatch, WatchWrite, WatchWriteAnswer } from "./schemas/watch-schema";
import type { ShellLayout } from "./shell-state";

/** The storage resolver (`61` section 2.2, `62` section 3.6): the program's one fork point between the fileserver's
 *  REST stores, the browser's local ones and the account backend. Each persisted domain is a `DomainStore` - a read
 *  and a write, zod at the boundary - and a transport service consults the resolver at every call, so the choice is
 *  never frozen at boot. The two inputs are the runtime (`window.pocHost`, the signal `services/desktop.ts` reads)
 *  and the session, which the store's session slice answers live. */

/** One persisted domain's two operations. `read` answers the domain's current value; `write` applies a change and
 *  answers the value as this backend now holds it, which is the contract the REST answers set. */
export interface DomainStore<Read, Write> {
  readonly read: (signal?: AbortSignal) => Promise<Read>;
  readonly write: (value: Write, signal?: AbortSignal) => Promise<Read>;
}

export type ShellStore = DomainStore<ShellLayout, ShellLayout>;
export type SettingsStore = DomainStore<SettingsAnswer, SettingsPatch>;

/** The watch domain's store (`61` section 2.5): the Player's write - whose `keepalive` the local backend accepts and
 *  leaves unused, since an IndexedDB put is issued at once - plus the Library's removals, which only this domain
 *  answers for. Removal is part of the domain rather than a whole-value write, so it sits beside the DomainStore pair. */
export interface WatchStore {
  readonly write: (
    value: WatchWrite,
    options?: { readonly keepalive?: boolean },
    signal?: AbortSignal,
  ) => Promise<WatchWriteAnswer>;
  readonly remove: (watchId: string, signal?: AbortSignal) => Promise<RemovedWatch>;
  readonly clear: (signal?: AbortSignal) => Promise<ClearedWatch>;
}

/** The pair of backends a whole-document domain offers the resolver: the fileserver's REST store and the browser's
 *  local one. The REST calls themselves stay in the resource modules (`02` section 2.2). */
export interface DomainBackends<Read, Write> {
  readonly server: DomainStore<Read, Write>;
  readonly local: DomainStore<Read, Write>;
}

export type ShellBackends = DomainBackends<ShellLayout, ShellLayout>;

/** The watch domain's pair of backends; its store is its own interface, so it carries its own pair. */
export interface WatchBackends {
  readonly server: WatchStore;
  readonly local: WatchStore;
}

/** The settings domain's backends with the account backend beside them (`62` D9: no new mechanism, one more home). */
export interface SettingsBackends extends DomainBackends<SettingsAnswer, SettingsPatch> {
  readonly account: SettingsStore;
}

/** The domains that resolve to a whole store; favorites and collections are verb sets, routed by `routeFor` below. */
export type DomainKey = "shell" | "settings" | "watch";

/** The domains the account can own (`62` section 3.6): never the shell or the watch, whose rows of the matrix are
 *  the runtime alone. */
export type AccountDomain = "settings" | "favorites" | "collections";

/** Where a domain can land. `unavailable` means the runtime and session combination has no home for it: a signed-out
 *  browser has no favorites or collections of its own, and the controls say why (docs/06's disabled-with-reason rule). */
export type BackendName = "server" | "local" | "account" | "unavailable";

/** The resolver's inputs. `signedIn` is live since `62`: the store's session slice answers it at every call. */
export interface StoreInputs {
  readonly signedIn?: boolean;
}

/** The desktop signal, read the way `services/desktop.ts` reads its preload capability. It is available before any
 *  fetch, which is why the browser's hydration may consult it before `GET /api/state` answers. */
export function onDesktopRuntime(): boolean {
  return typeof window !== "undefined" && window.pocHost?.runtime === "electron";
}

/** The one matrix (`62` section 3.6), for the domains the account owns: signed in, the account; signed out, the
 *  desktop keeps the fileserver and a browser keeps its local store - except favorites and collections, which a
 *  signed-out browser has no home for at all. Pure. */
export function routeFor(domain: AccountDomain, inputs: StoreInputs = {}): BackendName {
  if (inputs.signedIn === true) return "account";
  if (onDesktopRuntime()) return "server";
  return domain === "settings" ? "local" : "unavailable";
}

export function storeFor(domain: "shell", backends: ShellBackends, inputs?: StoreInputs): ShellStore;
export function storeFor(domain: "settings", backends: SettingsBackends, inputs?: StoreInputs): SettingsStore;
export function storeFor(domain: "watch", backends: WatchBackends, inputs?: StoreInputs): WatchStore;
export function storeFor(
  domain: DomainKey,
  backends: ShellBackends | SettingsBackends | WatchBackends,
  inputs: StoreInputs = {},
): ShellStore | SettingsStore | WatchStore {
  /* The shell and the watch never move to the account (`62` section 3.6): their rows of the matrix are the runtime
   *  alone, signed in or out - the desktop's layout and history stay the fileserver's, a browser's stay local. The
   *  settings consult the account matrix. */
  if (domain === "shell" || domain === "watch") return onDesktopRuntime() ? backends.server : backends.local;
  const route = routeFor("settings", inputs);
  const settings = backends as SettingsBackends;
  return route === "unavailable" ? settings.local : settings[route];
}
