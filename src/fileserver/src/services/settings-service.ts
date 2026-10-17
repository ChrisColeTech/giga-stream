import { normalizeAdminUrl } from "../lib/admin-url.js";
import { AppError } from "../lib/app-error.js";
import type { SettingsRepository } from "../store/settings-repository.js";
import {
  SETTING_DEFAULTS,
  SETTING_INVALID_MESSAGES,
  SETTING_KEYS,
  SETTING_SCHEMAS,
  type SettingKey,
  type Settings,
} from "../types/settings.js";

export interface SettingsService {
  /** Every key present: a stored value that fails its check reads as the default. */
  get(): Settings;
  /**
   * Commit a patch (docs/03 section 3.2): any invalid or unknown row refuses the whole request
   * (`422 settings.invalid`, naming the row); otherwise the differing rows commit together and the
   * committed settings are returned.
   */
  patch(input: Record<string, unknown>): Settings;
}

export function createSettingsService(deps: {
  repository: SettingsRepository;
  allowInsecureAdmin: boolean;
  now: () => number;
  /** The admin address before one is saved: the production backend's port in the packaged app. */
  defaultAdminUrl?: string;
}): SettingsService {
  const { repository, allowInsecureAdmin, now } = deps;
  const defaults = { ...SETTING_DEFAULTS, adminUrl: deps.defaultAdminUrl ?? SETTING_DEFAULTS.adminUrl };

  function get(): Settings {
    const stored = repository.readAll();
    const pick = <K extends SettingKey>(key: K): Settings[K] => {
      const parsed = SETTING_SCHEMAS[key].safeParse(stored.get(key));
      return parsed.success ? parsed.data : defaults[key];
    };
    const adminUrl = normalizeAdminUrl(pick("adminUrl"), allowInsecureAdmin);
    return {
      autoplay: pick("autoplay"),
      theme: pick("theme"),
      themeAccent: pick("themeAccent"),
      reducedMotion: pick("reducedMotion"),
      uiZoom: pick("uiZoom"),
      videoQuality: pick("videoQuality"),
      audioLanguage: pick("audioLanguage"),
      lowLatency: pick("lowLatency"),
      pictureFit: pick("pictureFit"),
      resumeMode: pick("resumeMode"),
      watchedPercent: pick("watchedPercent"),
      liveOnOpen: pick("liveOnOpen"),
      libraryView: pick("libraryView"),
      librarySort: pick("librarySort"),
      showContinue: pick("showContinue"),
      subtitleLanguage: pick("subtitleLanguage"),
      pauseHistory: pick("pauseHistory"),
      rescanOnStartup: pick("rescanOnStartup"),
      adminUrl,
    };
  }

  return {
    get,

    patch(input) {
      const current = get();
      const commit = new Map<string, unknown>();
      for (const entry of Object.entries(input)) {
        const key = entry[0] as SettingKey;
        const value = entry[1];
        if (!(SETTING_KEYS as readonly string[]).includes(key)) {
          throw new AppError("settings.invalid", 422, `The setting "${key}" does not exist.`);
        }
        if (key === "adminUrl" && typeof value === "string") {
          commit.set(key, normalizeAdminUrl(value, allowInsecureAdmin));
          continue;
        }
        const parsed = SETTING_SCHEMAS[key].safeParse(value);
        if (!parsed.success) {
          throw new AppError("settings.invalid", 422, SETTING_INVALID_MESSAGES[key]);
        }
        commit.set(key, parsed.data);
      }
      const differing = [...commit].filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(current[key as SettingKey]));
      if (differing.length > 0) repository.writeMany(new Map(differing), now());
      return get();
    },
  };
}

export type { SettingsService as Settings };
