import { DEFAULT_SETTINGS } from "@/constants/settings-defaults";
import { DEFAULT_SURFACE, SIDES, SURFACE_ORDER, limitsOf, paneKey } from "@/constants/surfaces";
import type { SettingsAnswer, SettingsPatch } from "@/services/schemas/settings-schema";
import type { StateSnapshot } from "@/services/state";
import { acceptSettings, applySnapshot, rejectSettings } from "@/store/shell-hydration";
import type { SettingsFields } from "@/store/settings-state";
import { togglePane, toggleTheatre } from "@/store/theatre";
import type { AppState } from "@/store/app-store";
import type { Box } from "@/types/child-window";
import type { EventArea } from "@/types/events";
import type { ItemRef } from "@/types/library";
import type { OverlayId, PopupAnchor } from "@/types/overlays";
import type { MotionPreference, PaneKey, PaneSide, Surface, ThemeMode } from "@/types/shell";
import { createChromeSlice, type ChromeSet } from "@giga/ui/store/chrome-slice";
import type { ChromeKinds, ChromeSlice } from "@giga/ui/store/chrome-types";
import { clampZoom } from "@giga/ui/lib/settings-zoom";

/** The interface's kinds for the shared chrome slice: its event areas, overlays, popup anchors, items, window boxes. */
export interface ShellKinds extends ChromeKinds {
  area: EventArea;
  overlay: OverlayId;
  anchor: PopupAnchor;
  item: ItemRef;
  box: Box;
}

/** Which areas of the interface are working (`50` section 2.3): the statusbar's bar reads it in real time. Transient
 *  session state — the hydration snapshot never writes it and nothing restores it. */
export interface ActivityFlags {
  library: boolean;
  video: boolean;
  live: boolean;
  search: boolean;
}

/** The interface's shell state: the shared chrome fields, plus its panes, Theatre, hydration and settings write-back.
 */
export interface ShellSlice extends Omit<ChromeSlice<ShellKinds>, "theme" | "motion" | "setTheme" | "setMotion"> {
  theme: ThemeMode;
  motion: MotionPreference;
  setTheme: (theme: ThemeMode) => void;
  setMotion: (motion: MotionPreference) => void;
  adminUrl: string;
  surface: Surface;
  open: Partial<Record<PaneKey, boolean>>;
  sizes: Partial<Record<PaneKey, number>>;
  openVersion: number;
  appVersion: string | null;
  runtime: "electron" | "browser" | null;
  /** Theatre mode (owner, 2026-10-17): black chrome, panes collapsed on entry; leaving leaves the panes as they are. */
  theatre: boolean;
  toggleTheatre: () => void;
  /** Theatre's bars are faded out after idle seconds (useTheatreIdle owns the timer; this only holds the result).
   *  Always false outside Theatre. */
  chromeIdle: boolean;
  setChromeIdle: (value: boolean) => void;
  activity: ActivityFlags;
  setActivity: (area: keyof ActivityFlags, on: boolean) => void;
  /** Bumped every time the statusbar's Stop asks playback to stop (`50` section 2.4). Consumers answer the change
   *  itself, so a second press is just another idempotent action, never a queued one. */
  stopRequest: number;
  requestStop: () => void;
  hydrationApplied: boolean;
  shellVisible: boolean;
  shellWriteEnabled: boolean;
  settingsWriteEnabled: boolean;
  hydrationVersion: number;
  shellRevision: number;
  savedShellRevision: number;
  settingsRevision: number;
  savedSettingsRevision: number;
  committedSettings: SettingsAnswer;
  applySnapshot: (snapshot: StateSnapshot) => void;
  applyCommittedSettings: (settings: SettingsAnswer, revision: number, patch: SettingsPatch) => void;
  rejectSettings: (revision: number, patch: SettingsPatch) => void;
  revealShell: () => void;
  markShellSaved: (revision: number) => void;
  markSettingsSaved: (revision: number) => void;
  setSurface: (surface: Surface) => void;
  togglePane: (side: PaneSide) => void;
  commitSizes: (patch: Partial<Record<PaneKey, number>>) => void;
  setAdminUrl: (adminUrl: string) => number;
}

function initialPanes(): Pick<ShellSlice, "open" | "sizes"> {
  const open: Partial<Record<PaneKey, boolean>> = {};
  const sizes: Partial<Record<PaneKey, number>> = {};
  for (const surface of SURFACE_ORDER) {
    for (const side of SIDES) {
      const limits = limitsOf(surface, side);
      if (limits === null) continue;
      open[paneKey(surface, side)] = true;
      sizes[paneKey(surface, side)] = limits.preferred;
    }
  }
  return { open, sizes };
}

type Set = (partial: Partial<AppState>) => void;
type Get = () => AppState;

export function shellSlice(set: Set, get: Get): ShellSlice {
  const setChrome: ChromeSet<ShellKinds> = (partial) => {
    const { theme, motion, setTheme, setMotion, ...rest } = partial;
    void setTheme;
    void setMotion;
    set({
      ...rest,
      ...(theme === "dark" || theme === "light" ? { theme } : {}),
      ...(motion === "off" || motion === "on" ? { motion } : {}),
    });
  };
  const getChrome = (): ChromeSlice<ShellKinds> => {
    const state = get();
    return {
      ...state,
      setTheme: (theme) => { if (theme === "dark" || theme === "light") state.setTheme(theme); },
      setMotion: (motion) => { if (motion === "off" || motion === "on") state.setMotion(motion); },
    };
  };
  const chrome = createChromeSlice<ShellKinds>(setChrome, getChrome, {
    defaults: {
      theme: DEFAULT_SETTINGS.theme,
      accent: DEFAULT_SETTINGS.themeAccent,
      motion: DEFAULT_SETTINGS.reducedMotion,
      uiZoom: DEFAULT_SETTINGS.uiZoom,
    },
    defaultArea: "Connection",
  });
  return {
    ...chrome,
    theme: DEFAULT_SETTINGS.theme,
    motion: DEFAULT_SETTINGS.reducedMotion,
    /* A change made in the window is a setting: each one bumps the revision the settings write-back saves by. */
    setTheme: (theme) => changeSetting(set, get, { theme }),
    setAccent: (accent) => changeSetting(set, get, { accent }),
    setMotion: (motion) => changeSetting(set, get, { motion }),
    setZoom: (uiZoom) => changeSetting(set, get, { uiZoom: clampZoom(uiZoom) }),
    surface: DEFAULT_SURFACE,
    ...initialPanes(),
    openVersion: 0,
    adminUrl: DEFAULT_SETTINGS.adminUrl,
    appVersion: null,
    runtime: null,
    theatre: false,
    toggleTheatre: () => toggleTheatre(set, get),
    chromeIdle: false,
    setChromeIdle: (value) => set({ chromeIdle: value }),
    activity: { library: false, video: false, live: false, search: false },
    setActivity: (area, on) => {
      const activity = { ...get().activity };
      activity[area] = on;
      set({ activity });
    },
    stopRequest: 0,
    requestStop: () => set({ stopRequest: get().stopRequest + 1 }),
    hydrationApplied: false,
    shellVisible: false,
    shellWriteEnabled: false,
    settingsWriteEnabled: false,
    hydrationVersion: 0,
    shellRevision: 0,
    savedShellRevision: 0,
    settingsRevision: 0,
    savedSettingsRevision: 0,
    committedSettings: DEFAULT_SETTINGS,
    applySnapshot: (snapshot) => applySnapshot(set, get, snapshot),
    applyCommittedSettings: (settings, revision, patch) => acceptSettings(set, get, settings, revision, patch),
    rejectSettings: (revision, patch) => rejectSettings(set, get, revision, patch),
    revealShell: () => set({ shellVisible: true }),
    markShellSaved: (revision) => set({ savedShellRevision: Math.max(get().savedShellRevision, revision) }),
    markSettingsSaved: (revision) => set({ savedSettingsRevision: Math.max(get().savedSettingsRevision, revision) }),
    setSurface: (surface) => set({ surface, shellRevision: get().shellRevision + 1 }),
    togglePane: (side) => togglePane(set, get, side),
    commitSizes: (patch) => set({ sizes: { ...get().sizes, ...patch }, shellRevision: get().shellRevision + 1 }),
    setAdminUrl: (adminUrl) => changeAdminUrl(set, get, adminUrl),
  };
}

function changeSetting(set: Set, get: Get, patch: Partial<SettingsFields>): void {
  set({ ...patch, settingsRevision: get().settingsRevision + 1 });
}

function changeAdminUrl(set: Set, get: Get, adminUrl: string): number {
  const revision = get().settingsRevision + 1;
  set({ adminUrl, settingsRevision: revision });
  return revision;
}
