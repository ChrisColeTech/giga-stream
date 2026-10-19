import type { SettingsAnswer, SettingsPatch } from "@/services/schemas/settings-schema";
import { fromWireShell } from "@/services/shell-state";
import type { StateSnapshot } from "@/services/state";
import type { AppState } from "./app-store";
import { fieldsOfSettings, sameList, settingsOfFields } from "./settings-state";
import { sameMedia } from "@/lib/library-media";

type Set = (partial: Partial<AppState>) => void;
type Get = () => AppState;

export function applySnapshot(set: Set, get: Get, snapshot: StateSnapshot): void {
  const state = get();
  if (state.hydrationApplied) return;
  const layout = snapshot.shell === undefined ? undefined : fromWireShell(snapshot.shell);
  const settings = snapshot.settings;
  set({
    ...(layout === undefined
      ? {}
      : {
          surface: layout.surface,
          open: { ...state.open, ...layout.open },
          sizes: { ...state.sizes, ...layout.sizes },
          hydrationVersion: state.hydrationVersion + 1,
        }),
    ...(settings === undefined ? {} : fieldsOfSettings(settings)),
    ...(snapshot.version === undefined ? {} : { appVersion: snapshot.version }),
    ...(snapshot.host === undefined ? {} : { runtime: snapshot.host.runtime }),
    backend: snapshot.backend,
    ...(snapshot.channels === undefined ? {} : { channels: snapshot.channels }),
    lastChannelId: snapshot.lastChannelId ?? null,
    ...(snapshot.collections === undefined ? {} : { collections: snapshot.collections }),
    ...(snapshot.jobs === undefined ? {} : { jobs: snapshot.jobs }),
    hydrationApplied: true,
    shellWriteEnabled: layout !== undefined,
    settingsWriteEnabled: settings !== undefined,
    ...(layout === undefined ? {} : { savedShellRevision: state.shellRevision }),
    ...(settings === undefined ? {} : { savedSettingsRevision: state.settingsRevision }),
    committedSettings: settings ?? state.committedSettings,
  });
}

export function acceptSettings(
  set: Set,
  get: Get,
  settings: SettingsAnswer,
  revision: number,
  patch: SettingsPatch,
): void {
  const state = get();
  const applied = state.settingsRevision === revision
    ? settings
    : settledSettings(settingsOfFields(state), patch, settings);
  set({
    committedSettings: settings,
    savedSettingsRevision: Math.max(state.savedSettingsRevision, revision),
    ...fieldsOfSettings(applied),
  });
}

export function rejectSettings(set: Set, get: Get, revision: number, patch: SettingsPatch): void {
  const state = get();
  const applied = state.settingsRevision === revision
    ? state.committedSettings
    : settledSettings(settingsOfFields(state), patch, state.committedSettings);
  set({
    savedSettingsRevision: Math.max(state.savedSettingsRevision, revision),
    ...fieldsOfSettings(applied),
  });
}

function settledSettings(local: SettingsAnswer, sent: SettingsPatch, answer: SettingsAnswer): SettingsAnswer {
  return {
    ...local,
    ...(sent.theme === local.theme ? { theme: answer.theme } : {}),
    ...(sent.themeAccent === local.themeAccent ? { themeAccent: answer.themeAccent } : {}),
    ...(sent.reducedMotion === local.reducedMotion ? { reducedMotion: answer.reducedMotion } : {}),
    ...(sent.uiZoom === local.uiZoom ? { uiZoom: answer.uiZoom } : {}),
    ...(sent.autoplay === local.autoplay ? { autoplay: answer.autoplay } : {}),
    ...(sent.videoQuality === local.videoQuality ? { videoQuality: answer.videoQuality } : {}),
    ...(sent.audioLanguage === local.audioLanguage ? { audioLanguage: answer.audioLanguage } : {}),
    ...(sent.subtitleLanguage === local.subtitleLanguage ? { subtitleLanguage: answer.subtitleLanguage } : {}),
    ...(sent.lowLatency === local.lowLatency ? { lowLatency: answer.lowLatency } : {}),
    ...(sent.pictureFit === local.pictureFit ? { pictureFit: answer.pictureFit } : {}),
    ...(sent.resumeMode === local.resumeMode ? { resumeMode: answer.resumeMode } : {}),
    ...(sent.watchedPercent === local.watchedPercent ? { watchedPercent: answer.watchedPercent } : {}),
    ...(sent.liveOnOpen === local.liveOnOpen ? { liveOnOpen: answer.liveOnOpen } : {}),
    ...(sent.libraryView === local.libraryView ? { libraryView: answer.libraryView } : {}),
    ...(sent.librarySort === local.librarySort ? { librarySort: answer.librarySort } : {}),
    ...(sent.showContinue === local.showContinue ? { showContinue: answer.showContinue } : {}),
    ...(sent.pauseHistory === local.pauseHistory ? { pauseHistory: answer.pauseHistory } : {}),
    ...(sent.rescanOnStartup === local.rescanOnStartup ? { rescanOnStartup: answer.rescanOnStartup } : {}),
    ...(sent.adminUrl === local.adminUrl ? { adminUrl: answer.adminUrl } : {}),
    ...(sent.defaultSource === local.defaultSource ? { defaultSource: answer.defaultSource } : {}),
    ...(sent.libraryScope !== undefined && sameMedia(sent.libraryScope, local.libraryScope)
      ? { libraryScope: answer.libraryScope } : {}),
    ...(sent.librarySource === local.librarySource ? { librarySource: answer.librarySource } : {}),
    ...(sent.libraryGenres !== undefined && sameList(sent.libraryGenres, local.libraryGenres)
      ? { libraryGenres: answer.libraryGenres } : {}),
    ...(sent.libraryYear === local.libraryYear ? { libraryYear: answer.libraryYear } : {}),
    ...(sent.libraryWatched === local.libraryWatched ? { libraryWatched: answer.libraryWatched } : {}),
    ...(sent.libraryFilter === local.libraryFilter ? { libraryFilter: answer.libraryFilter } : {}),
  };
}
