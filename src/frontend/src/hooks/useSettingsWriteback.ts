import { useEffect } from "react";
import type { SettingsAnswer, SettingsPatch } from "@/services/schemas/settings-schema";
import { patchSettings } from "@/services/settings";
import { useAppStore, type AppState } from "@/store/app-store";
import { settingsPatchOf } from "@/store/settings-state";

interface PendingSettings {
  readonly revision: number;
  readonly patch: SettingsPatch;
}

interface SettingsWritebackDeps {
  readonly getState: () => AppState;
  readonly subscribe: (listener: (state: AppState) => void) => () => void;
  readonly write: (patch: SettingsPatch) => Promise<SettingsAnswer>;
}

/** Serializes settings writes so an older answer cannot replace a newer local choice. */
export function startSettingsWriteback(deps: SettingsWritebackDeps): () => void {
  let pending: PendingSettings | null = null;
  let writing = false;
  let active = true;

  const drain = async (): Promise<void> => {
    if (writing) return;
    writing = true;
    while (active && pending !== null) {
      const write = pending;
      pending = null;
      try {
        const answer = await deps.write(write.patch);
        if (!active) break;
        deps.getState().applyCommittedSettings(answer, write.revision);
        deps.getState().say("Settings saved.");
      } catch (error: unknown) {
        if (!active) break;
        deps.getState().rejectSettings(write.revision);
        const sentence = error instanceof Error ? error.message : "The settings were not saved.";
        deps.getState().say(sentence, "warn");
      }
    }
    writing = false;
  };

  const queue = (state: AppState): void => {
    if (!state.settingsWriteEnabled || state.settingsRevision <= state.savedSettingsRevision) return;
    pending = { revision: state.settingsRevision, patch: settingsPatchOf(state) };
    void drain();
  };

  const unsubscribe = deps.subscribe(queue);
  queue(deps.getState());
  return () => {
    active = false;
    unsubscribe();
  };
}

export function useSettingsWriteback(): void {
  useEffect(
    () =>
      startSettingsWriteback({
        getState: useAppStore.getState,
        subscribe: useAppStore.subscribe,
        write: patchSettings,
      }),
    [],
  );
}
