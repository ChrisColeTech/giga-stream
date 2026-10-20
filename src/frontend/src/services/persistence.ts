import type { SettingsAnswer, SettingsPatch } from "./schemas/settings-schema";
import type { ClearedWatch, RemovedWatch, WatchWrite, WatchWriteAnswer } from "./schemas/watch-schema";
import type { ShellLayout } from "./shell-state";

/** The storage resolver (`61` section 2.2): the program's one fork point between the fileserver's REST stores and
 *  the browser's local ones. Each persisted domain is a `DomainStore` - a read and a write, zod at the boundary -
 *  and a transport service hands both of its backends to `storeFor` at every call, so the choice is never frozen
 *  at boot. `62` adds the account backend and the real session beside these, with no new mechanism. */

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

/** The pair of backends a transport service offers the resolver: the fileserver's REST store and the browser's
 *  local one. The REST calls themselves stay in the resource modules (`02` section 2.2). */
export interface DomainBackends<Read, Write> {
  readonly server: DomainStore<Read, Write>;
  readonly local: DomainStore<Read, Write>;
}

export type ShellBackends = DomainBackends<ShellLayout, ShellLayout>;
export type SettingsBackends = DomainBackends<SettingsAnswer, SettingsPatch>;

/** The watch domain's pair of backends; its store is its own interface, so it carries its own pair. */
export interface WatchBackends {
  readonly server: WatchStore;
  readonly local: WatchStore;
}

/** The domains that resolve; favorites and collections join in `62`. */
export type DomainKey = "shell" | "settings" | "watch";

/** The resolver's second input, pinned to signed-out until `62` supplies the session. It will then route settings,
 *  favorites and collections to the account backend; today a signed-in caller keeps the server backend. */
export interface StoreInputs {
  readonly signedIn?: boolean;
}

/** The desktop signal, read the way `services/desktop.ts` reads its preload capability. It is available before any
 *  fetch, which is why the browser's hydration may consult it before `GET /api/state` answers. */
export function onDesktopRuntime(): boolean {
  return typeof window !== "undefined" && window.pocHost?.runtime === "electron";
}

export function storeFor(domain: "shell", backends: ShellBackends, inputs?: StoreInputs): ShellStore;
export function storeFor(domain: "settings", backends: SettingsBackends, inputs?: StoreInputs): SettingsStore;
export function storeFor(domain: "watch", backends: WatchBackends, inputs?: StoreInputs): WatchStore;
export function storeFor(
  domain: DomainKey,
  backends: ShellBackends | SettingsBackends | WatchBackends,
  inputs: StoreInputs = {},
): ShellStore | SettingsStore | WatchStore {
  void domain; // the domain names the account backend too, once `62` adds it beside these.
  if (onDesktopRuntime() || inputs.signedIn === true) return backends.server;
  return backends.local;
}
