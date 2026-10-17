import { notConnected, type ServiceResult } from "./not-connected";
import { api } from "./api";
import {
  SettingsPatchSchema,
  SettingsSchema,
  type SettingsAnswer,
  type SettingsPatch,
} from "./schemas/settings-schema";

export function readSettings(signal?: AbortSignal): Promise<SettingsAnswer> {
  return api("/api/settings", SettingsSchema, { signal });
}

export function patchSettings(patch: SettingsPatch, signal?: AbortSignal): Promise<SettingsAnswer> {
  return api("/api/settings", SettingsSchema, { method: "PATCH", body: patch, signal });
}

/** Saves one validated setting without allowing its value to become a request target. */
export function saveSetting(key: string, value: unknown, signal?: AbortSignal): Promise<SettingsAnswer> {
  return patchSettings(SettingsPatchSchema.parse({ [key]: value }), signal);
}

/** Reads the licence texts the fileserver bundles (`03` section 3.2, About), to show in Settings. Phase 1 stub. */
export function readLicences(): ServiceResult {
  return notConnected();
}
