import { fromWireShell } from "@/services/shell-state";
import type { SettingsAnswer } from "@/services/schemas/settings-schema";
import type { StateSnapshot } from "@/services/state";
import type { LibraryPrefs, PlaybackPrefs } from "@/types/settings";
import type { Accent, MotionPreference, PaneKey, Surface, ThemeMode } from "@/types/shell";

export interface ShellSlice {
  hydrationApplied: boolean;
  shellVisible: boolean;
  shellWriteEnabled: boolean;
  settingsWriteEnabled: boolean;
  hydrationVersion: number;
  shellRevision: number;
  savedShellRevision: number;
  settingsRevision: number;
  savedSettingsRevision: number;
  adminUrl: string;
  applySnapshot: (snapshot: StateSnapshot) => void;
  applyCommittedSettings: (settings: SettingsAnswer, revision: number) => void;
  revealShell: () => void;
  markShellSaved: (revision: number) => void;
  setAdminUrl: (adminUrl: string) => void;
}

interface Host {
  surface: Surface;
  open: Partial<Record<PaneKey, boolean>>;
  sizes: Partial<Record<PaneKey, number>>;
  theme: ThemeMode;
  accent: Accent;
  motion: MotionPreference;
  uiZoom: number;
  playback: PlaybackPrefs;
  library: LibraryPrefs;
}

type State = ShellSlice & Host;
type Set = (partial: Partial<State>) => void;
type Get = () => State;

function settingsPatch(settings: SettingsAnswer): Pick<State, "theme" | "accent" | "motion" | "uiZoom" | "playback" | "library" | "adminUrl"> {
  const { theme, themeAccent: accent, reducedMotion: motion, uiZoom, adminUrl } = settings;
  const playback: PlaybackPrefs = {
    autoplay: settings.autoplay,
    videoQuality: settings.videoQuality,
    audioLanguage: settings.audioLanguage,
    subtitleLanguage: settings.subtitleLanguage,
    lowLatency: settings.lowLatency,
    pictureFit: settings.pictureFit,
    resumeMode: settings.resumeMode,
    watchedPercent: settings.watchedPercent,
    liveOnOpen: settings.liveOnOpen,
  };
  const library: LibraryPrefs = {
    libraryView: settings.libraryView,
    librarySort: settings.librarySort,
    showContinue: settings.showContinue,
    pauseHistory: settings.pauseHistory,
    rescanOnStartup: settings.rescanOnStartup,
  };
  return { theme, accent, motion, uiZoom, playback, library, adminUrl };
}

export function shellSlice(set: Set, get: Get): ShellSlice {
  return {
    hydrationApplied: false,
    shellVisible: false,
    shellWriteEnabled: false,
    settingsWriteEnabled: false,
    hydrationVersion: 0,
    shellRevision: 0,
    savedShellRevision: 0,
    settingsRevision: 0,
    savedSettingsRevision: 0,
    adminUrl: "",
    applySnapshot: (snapshot) => {
      if (get().hydrationApplied) return;
      const layout = snapshot.shell === undefined ? undefined : fromWireShell(snapshot.shell);
      set({
        ...(layout === undefined
          ? {}
          : {
              surface: layout.surface,
              open: { ...get().open, ...layout.open },
              sizes: { ...get().sizes, ...layout.sizes },
              shellWriteEnabled: true,
              hydrationVersion: get().hydrationVersion + 1,
            }),
        ...(snapshot.settings === undefined ? {} : settingsPatch(snapshot.settings)),
        settingsWriteEnabled: snapshot.settings !== undefined,
        hydrationApplied: true,
        savedShellRevision: get().shellRevision,
        savedSettingsRevision: get().settingsRevision,
      });
    },
    applyCommittedSettings: (settings, revision) => {
      if (get().settingsRevision !== revision) return;
      set({ ...settingsPatch(settings), savedSettingsRevision: revision });
    },
    revealShell: () => set({ shellVisible: true }),
    markShellSaved: (revision) => set({ savedShellRevision: Math.max(get().savedShellRevision, revision) }),
    setAdminUrl: (adminUrl) => set({ adminUrl, settingsRevision: get().settingsRevision + 1 }),
  };
}
