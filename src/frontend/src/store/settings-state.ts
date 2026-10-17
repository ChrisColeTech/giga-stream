import type { SettingsAnswer, SettingsPatch } from "@/services/schemas/settings-schema";
import type { LibraryPrefs, PlaybackPrefs } from "@/types/settings";
import type { Accent, MotionPreference, ThemeMode } from "@/types/shell";

export interface SettingsFields {
  readonly theme: ThemeMode;
  readonly accent: Accent;
  readonly motion: MotionPreference;
  readonly uiZoom: number;
  readonly playback: PlaybackPrefs;
  readonly library: LibraryPrefs;
  readonly adminUrl: string;
}

export function fieldsOfSettings(settings: SettingsAnswer): SettingsFields {
  return {
    theme: settings.theme,
    accent: settings.themeAccent,
    motion: settings.reducedMotion,
    uiZoom: settings.uiZoom,
    playback: {
      autoplay: settings.autoplay,
      videoQuality: settings.videoQuality,
      audioLanguage: settings.audioLanguage,
      subtitleLanguage: settings.subtitleLanguage,
      lowLatency: settings.lowLatency,
      pictureFit: settings.pictureFit,
      resumeMode: settings.resumeMode,
      watchedPercent: settings.watchedPercent,
      liveOnOpen: settings.liveOnOpen,
    },
    library: {
      libraryView: settings.libraryView,
      librarySort: settings.librarySort,
      showContinue: settings.showContinue,
      pauseHistory: settings.pauseHistory,
      rescanOnStartup: settings.rescanOnStartup,
    },
    adminUrl: settings.adminUrl,
  };
}

export function settingsPatchOf(fields: SettingsFields): SettingsPatch {
  return {
    theme: fields.theme,
    themeAccent: fields.accent,
    reducedMotion: fields.motion,
    uiZoom: fields.uiZoom,
    ...fields.playback,
    ...fields.library,
    adminUrl: fields.adminUrl,
  };
}
