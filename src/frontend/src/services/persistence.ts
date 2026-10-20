import type { SettingsAnswer, SettingsPatch } from "./schemas/settings-schema";
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

/** The pair of backends a whole-document domain offers the resolver: the fileserver's REST store and the browser's
 *  local one. The REST calls themselves stay in the resource modules (`02` section 2.2). */
export interface DomainBackends<Read, Write> {
  readonly server: DomainStore<Read, Write>;
  readonly local: DomainStore<Read, Write>;
}

export type ShellBackends = DomainBackends<ShellLayout, ShellLayout>;

/** The settings domain's backends with the account backend beside them (`62` D9: no new mechanism, one more home). */
export interface SettingsBackends extends DomainBackends<SettingsAnswer, SettingsPatch> {
  readonly account: SettingsStore;
}

/** The domains that resolve to a whole store; favorites and collections are verb sets, routed by `routeFor` below. */
export type DomainKey = "shell" | "settings";

/** The domains the account can own (`62` section 3.6): settings, favorites and collections. */
export type AccountDomain = Exclude<DomainKey, "shell"> | "favorites" | "collections";

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
export function storeFor(
  domain: DomainKey,
  backends: ShellBackends | SettingsBackends,
  inputs: StoreInputs = {},
): ShellStore | SettingsStore {
  /* The shell never moves to the account (`62` section 3.6): its rows of the matrix are the runtime alone, signed in
   *  or out - the desktop's layout stays the fileserver's, a browser's stays local. */
  if (domain === "shell") return onDesktopRuntime() ? backends.server : backends.local;
  const route = routeFor("settings", inputs);
  const settings = backends as SettingsBackends;
  return route === "unavailable" ? settings.local : settings[route];
}
