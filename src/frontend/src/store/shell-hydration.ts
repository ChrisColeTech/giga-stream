import type { SettingsAnswer } from "@/services/schemas/settings-schema";
import { fromWireShell } from "@/services/shell-state";
import type { StateSnapshot } from "@/services/state";
import type { AppState } from "./app-store";
import { fieldsOfSettings } from "./settings-state";

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
    shellWriteEnabled: true,
    settingsWriteEnabled: true,
    savedShellRevision: state.shellRevision,
    savedSettingsRevision: state.settingsRevision,
    committedSettings: settings ?? state.committedSettings,
  });
}

export function acceptSettings(set: Set, get: Get, settings: SettingsAnswer, revision: number): void {
  const state = get();
  set({
    committedSettings: settings,
    savedSettingsRevision: Math.max(state.savedSettingsRevision, revision),
    ...(state.settingsRevision === revision ? fieldsOfSettings(settings) : {}),
  });
}

export function rejectSettings(set: Set, get: Get, revision: number): void {
  const state = get();
  set({
    savedSettingsRevision: Math.max(state.savedSettingsRevision, revision),
    ...(state.settingsRevision === revision ? fieldsOfSettings(state.committedSettings) : {}),
  });
}
