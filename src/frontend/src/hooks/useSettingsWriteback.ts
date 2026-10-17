import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { patchSettings } from "@/services/settings";
import { useAppStore } from "@/store/app-store";
import type { SettingsPatch } from "@/services/schemas/settings-schema";

export function useSettingsWriteback(): void {
  const store = useAppStore(
    useShallow((state) => ({
      settingsWriteEnabled: state.settingsWriteEnabled,
      settingsRevision: state.settingsRevision,
      savedSettingsRevision: state.savedSettingsRevision,
      theme: state.theme,
      accent: state.accent,
      motion: state.motion,
      uiZoom: state.uiZoom,
      playback: state.playback,
      library: state.library,
    })),
  );
  const { settingsWriteEnabled: enabled, settingsRevision: revision, savedSettingsRevision: saved } = store;

  useEffect(() => {
    if (!enabled || revision <= saved) return;
    const patch: SettingsPatch = {
      theme: store.theme,
      themeAccent: store.accent,
      reducedMotion: store.motion,
      uiZoom: store.uiZoom,
      ...store.playback,
      ...(store.library.libraryView === "rows" ? {} : { libraryView: store.library.libraryView }),
      librarySort: store.library.librarySort,
      showContinue: store.library.showContinue,
      pauseHistory: store.library.pauseHistory,
      rescanOnStartup: store.library.rescanOnStartup,
    };
    void patchSettings(patch)
      .then((answer) => useAppStore.getState().applyCommittedSettings(answer, revision))
      .catch((error: unknown) => {
        const sentence = error instanceof Error ? error.message : "The settings were not saved.";
        useAppStore.getState().say(sentence, "warn");
      });
  }, [enabled, revision, saved, store]);
}
