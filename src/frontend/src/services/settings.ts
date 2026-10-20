import { DEFAULT_SETTINGS } from "@/constants/settings-defaults";
import { useAppStore } from "@/store/app-store";
import { api } from "./api";
import { readLocalSettings, writeLocalSettings } from "./local-state";
import { storeFor, type SettingsBackends } from "./persistence";
import { type ServiceResult } from "./not-connected";
import {
  SettingsPatchSchema,
  SettingsSchema,
  type SettingsAnswer,
  type SettingsPatch,
} from "./schemas/settings-schema";

/** The two backends (`61` section 2.2). The server's is today's REST transport, byte for byte. The local one merges
 *  the patch over the last whole answer - the stored blob, or the store's committed baseline while there is none -
 *  and stores only what the wire schema accepts, so a refused write is the write-back's warning, never a half answer. */
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
};

export function readSettings(signal?: AbortSignal): Promise<SettingsAnswer> {
  return storeFor("settings", BACKENDS).read(signal);
}

export function patchSettings(patch: SettingsPatch, signal?: AbortSignal): Promise<SettingsAnswer> {
  return storeFor("settings", BACKENDS).write(patch, signal);
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
