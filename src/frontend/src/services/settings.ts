import { DEFAULT_SETTINGS } from "@/constants/settings-defaults";
import { SETTINGS_CACHE_NOTICE } from "@/constants/gate-copy";
import { useAppStore } from "@/store/app-store";
import { sessionInputs } from "@/store/selectors";
import { api } from "./api";
import { readLocalSettings, writeLocalSettings } from "./local-state";
import { onDesktopRuntime, storeFor, type SettingsBackends } from "./persistence";
import { type ServiceResult } from "./not-connected";
import {
  AccountSettingsSchema,
  SettingsPatchSchema,
  SettingsSchema,
  type SettingsAnswer,
  type SettingsPatch,
} from "./schemas/settings-schema";

/** The three backends (`61` section 2.2, `62` section 3.6). The server's is the fileserver's REST transport, byte for
 *  byte, and keeps the signed-out desktop. The local one merges the patch over the last whole answer - the stored
 *  blob, or the store's committed baseline while there is none - and stores only what the wire schema accepts, so a
 *  refused write is the write-back's warning, never a half answer. The account's is `62` section 3.3: a whole-
 *  document `PUT` (the last write wins, no server-side merge), with the browser's local store as the offline cache. */
const BACKENDS: SettingsBackends = {
  server: {
    read: (signal) => api("/api/settings", SettingsSchema, { signal }),
    write: (patch, signal) => api("/api/settings", SettingsSchema, { method: "PATCH", body: patch, signal }),
  },
  local: {
    read: async () => readLocalSettings().value ?? DEFAULT_SETTINGS,
    write: async (patch) => {
      const base = readLocalSettings().value ?? useAppStore.getState().committedSettings;
      const answer: SettingsAnswer = { ...base, ...patch };
      if (!writeLocalSettings(answer)) throw new Error("The settings could not be saved in this browser.");
      return answer;
    },
  },
  account: {
    read: async (signal) => {
      const answer = await api("/api/account/settings", AccountSettingsSchema, { signal });
      return { ...DEFAULT_SETTINGS, ...answer.settings };
    },
    write: async (patch, signal) => {
      const document = { ...useAppStore.getState().committedSettings, ...patch };
      const answer = await api("/api/account/settings", AccountSettingsSchema, { method: "PUT", body: document, signal });
      const saved: SettingsAnswer = { ...DEFAULT_SETTINGS, ...answer.settings };
      if (!onDesktopRuntime() && !writeLocalSettings(saved)) {
        useAppStore.getState().say(SETTINGS_CACHE_NOTICE, "warn");
      }
      return saved;
    },
  },
};

export function readSettings(signal?: AbortSignal): Promise<SettingsAnswer> {
  return storeFor("settings", BACKENDS, sessionInputs()).read(signal);
}

export function patchSettings(patch: SettingsPatch, signal?: AbortSignal): Promise<SettingsAnswer> {
  return storeFor("settings", BACKENDS, sessionInputs()).write(patch, signal);
}

/** Saves one validated setting without allowing its value to become a request target. */
export function saveSetting(key: string, value: unknown, signal?: AbortSignal): Promise<SettingsAnswer> {
  return patchSettings(SettingsPatchSchema.parse({ [key]: value }), signal);
}

/** About asks the fileserver for the bundled licence texts (`06` section 6.2); the fileserver registers no
 *  /api/licences route yet, so the press stays disabled with its truthful reason instead of an invented one. */
export function readLicences(): ServiceResult {
  return { ok: false, message: "The fileserver does not serve licences yet." };
}
