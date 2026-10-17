import { DEFAULT_SETTINGS } from "@/constants/settings-defaults";
import { DEFAULT_SURFACE, SIDES, SURFACE_ORDER, limitsOf, paneKey } from "@/constants/surfaces";
import { appendEvent, type EventInput } from "@/lib/event-log";
import type { SettingsAnswer, SettingsPatch } from "@/services/schemas/settings-schema";
import type { StateSnapshot } from "@/services/state";
import { acceptSettings, applySnapshot, rejectSettings } from "@/store/shell-hydration";
import type { SettingsFields } from "@/store/settings-state";
import { togglePane, toggleTheatre } from "@/store/theatre";
import type { AppState } from "@/store/app-store";
import type { Box } from "@/types/child-window";
import type { EventRow } from "@/types/events";
import type { ItemRef } from "@/types/library";
import type { OverlayId, PopupAnchor } from "@/types/overlays";
import type { PaneKey, PaneSide, Surface } from "@/types/shell";

export interface Notice {
  readonly sentence: string;
  readonly tone: "info" | "warn" | "error";
  readonly serial: number;
}

export interface ShellSlice {
  theme: SettingsFields["theme"];
  accent: SettingsFields["accent"];
  motion: SettingsFields["motion"];
  uiZoom: number;
  adminUrl: string;
  surface: Surface;
  open: Partial<Record<PaneKey, boolean>>;
  sizes: Partial<Record<PaneKey, number>>;
  openVersion: number;
  eventsOpen: boolean;
  overlay: OverlayId | null;
  overlayAnchor: PopupAnchor;
  overlayItem: ItemRef | null;
  childBounds: Readonly<Record<string, Box>>;
  notice: Notice | null;
  events: readonly EventRow[];
  folded: Readonly<Record<string, boolean>>;
  appVersion: string | null;
  runtime: "electron" | "browser" | null;
  /** Theatre mode (owner, 2026-10-17): black chrome, panes collapsed on entry; leaving leaves the panes as they are. */
  theatre: boolean;
  toggleTheatre: () => void;
  /** Theatre's bars are faded out after idle seconds (useTheatreIdle owns the timer; this only holds the result).
   *  Always false outside Theatre. */
  chromeIdle: boolean;
  setChromeIdle: (value: boolean) => void;
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
  toggleEvents: () => void;
  openOverlay: (id: OverlayId, anchor?: PopupAnchor, item?: ItemRef | null) => void;
  closeOverlay: () => void;
  setZoom: (uiZoom: number) => void;
  setAdminUrl: (adminUrl: string) => number;
  rememberChild: (key: string, box: Box) => void;
  toggleFold: (id: string) => void;
  say: (sentence: string, tone?: Notice["tone"]) => void;
  clearEvents: () => void;
  logEvent: (event: EventInput) => void;
  setTheme: (theme: SettingsFields["theme"]) => void;
  setAccent: (accent: SettingsFields["accent"]) => void;
  setMotion: (motion: SettingsFields["motion"]) => void;
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
  return {
    surface: DEFAULT_SURFACE,
    ...initialPanes(),
    openVersion: 0,
    eventsOpen: false,
    overlay: null,
    overlayAnchor: null,
    overlayItem: null,
    childBounds: {},
    notice: null,
    events: [],
    folded: {},
    theme: DEFAULT_SETTINGS.theme,
    accent: DEFAULT_SETTINGS.themeAccent,
    motion: DEFAULT_SETTINGS.reducedMotion,
    uiZoom: DEFAULT_SETTINGS.uiZoom,
    adminUrl: DEFAULT_SETTINGS.adminUrl,
    appVersion: null,
    runtime: null,
    theatre: false,
    toggleTheatre: () => toggleTheatre(set, get),
    chromeIdle: false,
    setChromeIdle: (value) => set({ chromeIdle: value }),
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
    toggleEvents: () => set({ eventsOpen: !get().eventsOpen }),
    openOverlay: (overlay, overlayAnchor = null, overlayItem = null) => set({ overlay, overlayAnchor, overlayItem }),
    closeOverlay: () => set({ overlay: null, overlayAnchor: null, overlayItem: null }),
    setZoom: (uiZoom) => changeSetting(set, get, { uiZoom: Math.min(3, Math.max(0.5, uiZoom)) }),
    setAdminUrl: (adminUrl) => changeAdminUrl(set, get, adminUrl),
    rememberChild: (key, box) => set({ childBounds: { ...get().childBounds, [key]: box } }),
    toggleFold: (id) => set({ folded: { ...get().folded, [id]: !get().folded[id] } }),
    say: (sentence, tone = "info") => say(set, get, sentence, tone),
    clearEvents: () => set({ events: [] }),
    logEvent: (event) => set({ events: appendEvent(get().events, event) }),
    setTheme: (theme) => changeSetting(set, get, { theme }),
    setAccent: (accent) => changeSetting(set, get, { accent }),
    setMotion: (motion) => changeSetting(set, get, { motion }),
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

function say(set: Set, get: Get, sentence: string, tone: Notice["tone"]): void {
  const serial = (get().notice?.serial ?? 0) + 1;
  const row: EventRow | null =
    tone === "info" ? null : { id: `n-${serial}-${Date.now()}`, at: Date.now(), tone, area: "Connection", sentence };
  set({ notice: { sentence, tone, serial }, ...(row === null ? {} : { events: appendEvent(get().events, row) }) });
}
