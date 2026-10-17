import { type ServiceResult } from "./not-connected";
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

/** About asks the fileserver for the bundled licence texts (`06` section 6.2); the fileserver registers no
 *  /api/licences route yet, so the press stays disabled with its truthful reason instead of an invented one. */
export function readLicences(): ServiceResult {
  return { ok: false, message: "The fileserver does not serve licences yet." };
}
