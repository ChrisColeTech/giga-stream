import { z } from "zod";
import { ShellStateSchema, type ShellStateAnswer } from "./schemas/state-schema";
import { SettingsSchema, type SettingsAnswer } from "./schemas/settings-schema";

/** The browser runtime's local store (`61` section 2.3). This file is the program's one browser-storage home: the
 *  rule checker allow-lists it (and the watch store wave 2 adds beside it) and nothing else. The keys carry a
 *  version so a later format change is a new key rather than a migration in place, and every read and write is
 *  validated with the same wire schema the fileserver answers with, so a corrupt, hand-edited or outdated blob is
 *  discarded exactly like a failed part of `decodeState` and the next whole write replaces it. */

export const LOCAL_SHELL_KEY = "giga.v1.shell";
export const LOCAL_SETTINGS_KEY = "giga.v1.settings";
export const LOCAL_LAST_CHANNEL_KEY = "giga.v1.lastChannelId";

/** The slice of DOM Storage the store needs; tests inject a stub of this shape instead of a real window. */
export type LocalStorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** One part's read: the validated value, or nothing plus `unreadable` when the stored blob could not be trusted. */
export interface LocalPart<T> {
  readonly value: T | undefined;
  readonly unreadable: boolean;
}

/** The browser's own storage, or null where there is none (a test, or a private mode that refuses the object).
 *  Reaching for `window.localStorage` can itself throw, so the access is guarded like any external value. */
export function browserStorage(): LocalStorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Whether a local store exists at all. Browser hydration opens only when it does, so a store-less environment
 *  keeps today's server-only behaviour instead of silently forgetting everything it is handed. */
export function localStateAvailable(): boolean {
  return browserStorage() !== null;
}

function readPart<T>(key: string, schema: z.ZodType<T>, storage: LocalStorageLike | null): LocalPart<T> {
  const raw = storage?.getItem(key);
  if (raw === null || raw === undefined) return { value: undefined, unreadable: false };
  let wire: unknown;
  try {
    wire = JSON.parse(raw);
  } catch {
    return { value: undefined, unreadable: true };
  }
  const parsed = schema.safeParse(wire);
  return parsed.success ? { value: parsed.data, unreadable: false } : { value: undefined, unreadable: true };
}

/** Stores one part, validated first, so no blob is ever written that the reader would have to discard. With no
 *  storage at all the write answers `true` - there is nothing to persist to, which is not a failure. A refused
 *  write (quota, private mode) answers `false` and never throws; the caller speaks the warning. */
function writePart<T>(key: string, schema: z.ZodType<T>, value: T, storage: LocalStorageLike | null): boolean {
  const parsed = schema.safeParse(value);
  if (!parsed.success) return false;
  if (storage === null) return true;
  try {
    storage.setItem(key, JSON.stringify(parsed.data));
    return true;
  } catch {
    return false;
  }
}

export function readLocalShell(storage: LocalStorageLike | null = browserStorage()): LocalPart<ShellStateAnswer> {
  return readPart(LOCAL_SHELL_KEY, ShellStateSchema, storage);
}

export function writeLocalShell(
  shell: ShellStateAnswer,
  storage: LocalStorageLike | null = browserStorage(),
): boolean {
  return writePart(LOCAL_SHELL_KEY, ShellStateSchema, shell, storage);
}

export function readLocalSettings(storage: LocalStorageLike | null = browserStorage()): LocalPart<SettingsAnswer> {
  return readPart(LOCAL_SETTINGS_KEY, SettingsSchema, storage);
}

export function writeLocalSettings(
  settings: SettingsAnswer,
  storage: LocalStorageLike | null = browserStorage(),
): boolean {
  return writePart(LOCAL_SETTINGS_KEY, SettingsSchema, settings, storage);
}

export function readLocalLastChannel(storage: LocalStorageLike | null = browserStorage()): LocalPart<string> {
  return readPart(LOCAL_LAST_CHANNEL_KEY, z.string(), storage);
}

export function writeLocalLastChannel(
  channelId: string,
  storage: LocalStorageLike | null = browserStorage(),
): boolean {
  return writePart(LOCAL_LAST_CHANNEL_KEY, z.string(), channelId, storage);
}

/** Removes only this app's versioned keys. A failure on one key does not stop attempts for its siblings. */
export function clearOwnedLocalState(storage: LocalStorageLike | null = browserStorage()): boolean {
  if (storage === null) return true;
  let cleared = true;
  for (const key of [LOCAL_SHELL_KEY, LOCAL_SETTINGS_KEY, LOCAL_LAST_CHANNEL_KEY]) {
    try {
      storage.removeItem(key);
    } catch {
      cleared = false;
    }
  }
  return cleared;
}
