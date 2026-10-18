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
      defaultSource: settings.defaultSource,
    },
    library: {
      libraryView: settings.libraryView,
      librarySort: settings.librarySort,
      showContinue: settings.showContinue,
      pauseHistory: settings.pauseHistory,
      rescanOnStartup: settings.rescanOnStartup,
      libraryScope: settings.libraryScope,
      librarySource: settings.librarySource,
      libraryGenres: settings.libraryGenres,
      libraryYear: settings.libraryYear,
      libraryWatched: settings.libraryWatched,
      libraryFilter: settings.libraryFilter,
    },
    adminUrl: settings.adminUrl,
  };
}

export function settingsOfFields(fields: SettingsFields): SettingsAnswer {
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

export const sameList =(a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((value, at) => value === b[at]);

export function settingsPatchOf(current: SettingsFields, baseline: SettingsAnswer): SettingsPatch {
  const value = settingsOfFields(current);
  return {
    ...(value.theme === baseline.theme ? {} : { theme: value.theme }),
    ...(value.themeAccent === baseline.themeAccent ? {} : { themeAccent: value.themeAccent }),
    ...(value.reducedMotion === baseline.reducedMotion ? {} : { reducedMotion: value.reducedMotion }),
    ...(value.uiZoom === baseline.uiZoom ? {} : { uiZoom: value.uiZoom }),
    ...(value.autoplay === baseline.autoplay ? {} : { autoplay: value.autoplay }),
    ...(value.videoQuality === baseline.videoQuality ? {} : { videoQuality: value.videoQuality }),
    ...(value.audioLanguage === baseline.audioLanguage ? {} : { audioLanguage: value.audioLanguage }),
    ...(value.subtitleLanguage === baseline.subtitleLanguage ? {} : { subtitleLanguage: value.subtitleLanguage }),
    ...(value.lowLatency === baseline.lowLatency ? {} : { lowLatency: value.lowLatency }),
    ...(value.pictureFit === baseline.pictureFit ? {} : { pictureFit: value.pictureFit }),
    ...(value.resumeMode === baseline.resumeMode ? {} : { resumeMode: value.resumeMode }),
    ...(value.watchedPercent === baseline.watchedPercent ? {} : { watchedPercent: value.watchedPercent }),
    ...(value.liveOnOpen === baseline.liveOnOpen ? {} : { liveOnOpen: value.liveOnOpen }),
    ...(value.libraryView === baseline.libraryView ? {} : { libraryView: value.libraryView }),
    ...(value.librarySort === baseline.librarySort ? {} : { librarySort: value.librarySort }),
    ...(value.showContinue === baseline.showContinue ? {} : { showContinue: value.showContinue }),
    ...(value.pauseHistory === baseline.pauseHistory ? {} : { pauseHistory: value.pauseHistory }),
    ...(value.rescanOnStartup === baseline.rescanOnStartup ? {} : { rescanOnStartup: value.rescanOnStartup }),
    ...(value.adminUrl === baseline.adminUrl ? {} : { adminUrl: value.adminUrl }),
    ...(value.defaultSource === baseline.defaultSource ? {} : { defaultSource: value.defaultSource }),
    ...(value.libraryScope === baseline.libraryScope ? {} : { libraryScope: value.libraryScope }),
    ...(value.librarySource === baseline.librarySource ? {} : { librarySource: value.librarySource }),
    ...(sameList(value.libraryGenres, baseline.libraryGenres) ? {} : { libraryGenres: value.libraryGenres }),
    ...(value.libraryYear === baseline.libraryYear ? {} : { libraryYear: value.libraryYear }),
    ...(value.libraryWatched === baseline.libraryWatched ? {} : { libraryWatched: value.libraryWatched }),
    ...(value.libraryFilter === baseline.libraryFilter ? {} : { libraryFilter: value.libraryFilter }),
  };
}
