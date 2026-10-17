import { create } from "zustand";
import { DEFAULT_SURFACE, SIDES, SURFACES, SURFACE_ORDER, limitsOf, paneKey } from "@/constants/surfaces";
import { EVENT_ROWS } from "@/fixtures/events";
import { SETTINGS_VALUES } from "@/fixtures/settings";
import type { EventRow } from "@/types/events";
import { navigationSlice, type NavigationSlice } from "./navigation-slice";
import type { Box } from "@/types/child-window";
import type { LibraryPrefs, PlaybackPrefs } from "@/types/settings";
import type { CollectionRow } from "@/types/collection";
import type { ItemRef } from "@/types/library";
import type { OverlayId, PopupAnchor } from "@/types/overlays";
import type { Accent, MotionPreference, PaneKey, PaneSide, Surface, ThemeMode } from "@/types/shell";

/** The statusbar's ONE notice line: an outcome or a refusal, as a sentence. */
export interface Notice {
  readonly sentence: string;
  readonly tone: "info" | "warn" | "error";
  /** Bumped per notice so an identical sentence still re-announces. */
  readonly serial: number;
}

/** The one store (`01` section 6). Serializable shell state only: no nodes, refs, promises or timers.
 *  Nothing here reads or writes browser storage; persistence arrives with the fileserver's settings rows. */
export interface AppState extends NavigationSlice {
  surface: Surface;
  /** Committed visibility per pane. A pane a surface does not have is never in this record. */
  open: Partial<Record<PaneKey, boolean>>;
  /** Committed size per pane, in pixels. */
  sizes: Partial<Record<PaneKey, number>>;
  /** Bumped by every open change so the tween engine travels only for toggles, never for a drag. */
  openVersion: number;
  eventsOpen: boolean;
  /** The one open flow (a work frame or a popup), or none. Opening a flow replaces the open one. */
  overlay: OverlayId | null;
  /** What the open popup hangs from; a work frame ignores it. */
  overlayAnchor: PopupAnchor;
  /** The item an open popup is about (Title Info, Add to collection); null for a work frame. */
  overlayItem: ItemRef | null;
  /** UI zoom (`03` section 3.2, `06` section 6.2): 0.5 to 3, applied to the whole interface. */
  uiZoom: number;
  /** Where each child window last was and how large, for the run: a window opened again is placed there. */
  childBounds: Readonly<Record<string, Box>>;
  notice: Notice | null;
  /** The events drawer's log (`06` section 7), newest last: the fixture's rows, then every warn or error notice. */
  events: readonly EventRow[];
  clearEvents: () => void;
  /** Every collection, as the library service reports them. Empty until that service is wired. */
  collections: readonly CollectionRow[];
  /** Folded form groups by id; absent means open. Fold state is shell state, kept across openings. */
  folded: Readonly<Record<string, boolean>>;
  theme: ThemeMode;
  accent: Accent;
  motion: MotionPreference;
  /** The playback preferences (`03` section 3.2): standing choices that apply to every stream. Phase 1a keeps them
   *  here, applied at once like the theme; phase 2 reads and saves them through the fileserver (`22`). */
  playback: PlaybackPrefs;
  /** The Library preferences (`03` section 3.2), edited in Settings > Library; phase 1a keeps them here. */
  library: LibraryPrefs;
  /** Favourites and collection memberships, by item key (`kind:id`). Phase 1a keeps the changes here, so every surface
   *  reads the same marks; phase 2 reads them from the fileserver (`22` section 3.3). */
  marks: {
    readonly favourites: Readonly<Record<string, boolean>>;
    readonly memberships: Readonly<Record<string, readonly string[]>>;
  };

  setSurface: (surface: Surface) => void;
  setFavourite: (key: string, favourite: boolean) => void;
  setMembership: (key: string, collectionId: string, member: boolean) => void;
  togglePane: (side: PaneSide) => void;
  commitSizes: (patch: Partial<Record<PaneKey, number>>) => void;
  toggleEvents: () => void;
  openOverlay: (id: OverlayId, anchor?: PopupAnchor, item?: ItemRef | null) => void;
  closeOverlay: () => void;
  setZoom: (uiZoom: number) => void;
  rememberChild: (key: string, box: Box) => void;
  toggleFold: (id: string) => void;
  say: (sentence: string, tone?: Notice["tone"]) => void;
  setTheme: (theme: ThemeMode) => void;
  setAccent: (accent: Accent) => void;
  setMotion: (motion: MotionPreference) => void;
  setPlayback: (change: Partial<PlaybackPrefs>) => void;
  setLibraryPrefs: (change: Partial<LibraryPrefs>) => void;
}

function initialPanes(): Pick<AppState, "open" | "sizes"> {
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

export const useAppStore = create<AppState>()((set, get) => ({
  surface: DEFAULT_SURFACE,
  ...initialPanes(),
  openVersion: 0,
  eventsOpen: false,
  overlay: null,
  overlayAnchor: null,
  overlayItem: null,
  uiZoom: 1,
  childBounds: {},
  notice: null,
  events: EVENT_ROWS,
  clearEvents: () => set({ events: [] }),
  collections: [],
  folded: {},
  theme: "dark",
  accent: "amber",
  motion: "system",
  playback: {
    autoplay: SETTINGS_VALUES.autoplay,
    videoQuality: SETTINGS_VALUES.videoQuality,
    audioLanguage: SETTINGS_VALUES.audioLanguage,
    subtitleLanguage: SETTINGS_VALUES.subtitleLanguage,
    lowLatency: SETTINGS_VALUES.lowLatency,
    pictureFit: SETTINGS_VALUES.pictureFit,
    resumeMode: SETTINGS_VALUES.resumeMode,
    watchedPercent: SETTINGS_VALUES.watchedPercent,
    liveOnOpen: SETTINGS_VALUES.liveOnOpen,
  },
  library: {
    libraryView: SETTINGS_VALUES.libraryView,
    librarySort: SETTINGS_VALUES.librarySort,
    showContinue: SETTINGS_VALUES.showContinue,
    pauseHistory: SETTINGS_VALUES.pauseHistory,
    rescanOnStartup: SETTINGS_VALUES.rescanOnStartup,
  },
  marks: { favourites: {}, memberships: {} },

  setSurface: (surface) => set({ surface }),

  togglePane: (side) => {
    const { surface, open, openVersion } = get();
    /* A surface without this pane has a disabled toggle; ignore the press. */
    if (SURFACES[surface].panes[side] === null) return;
    const key = paneKey(surface, side);
    set({ open: { ...open, [key]: !(open[key] ?? true) }, openVersion: openVersion + 1 });
  },

  /* Called once on drag end, never per pointer move. A size change is not an open change. */
  commitSizes: (patch) => set({ sizes: { ...get().sizes, ...patch } }),

  toggleEvents: () => set({ eventsOpen: !get().eventsOpen }),
  openOverlay: (id, anchor = null, item = null) => set({ overlay: id, overlayAnchor: anchor, overlayItem: item }),
  closeOverlay: () => set({ overlay: null, overlayAnchor: null, overlayItem: null }),
  setZoom: (uiZoom) => set({ uiZoom: Math.min(3, Math.max(0.5, uiZoom)) }),
  rememberChild: (key, box) => set({ childBounds: { ...get().childBounds, [key]: box } }),
  toggleFold: (id) => set({ folded: { ...get().folded, [id]: !get().folded[id] } }),
  say: (sentence, tone = "info") => {
    const serial = (get().notice?.serial ?? 0) + 1;
    /* A warn or an error is also a row of the events log; an info notice (a zoom reset) is not an event. */
    const row: EventRow | null =
      tone === "info" ? null : { id: `n-${serial}-${Date.now()}`, at: Date.now(), tone, area: "Connection", sentence };
    set({ notice: { sentence, tone, serial }, ...(row === null ? {} : { events: [...get().events, row].slice(-200) }) });
  },
  ...navigationSlice(set, get),
  setTheme: (theme) => set({ theme }),
  setAccent: (accent) => set({ accent }),
  setMotion: (motion) => set({ motion }),
  setPlayback: (change) => set({ playback: { ...get().playback, ...change } }),
  setLibraryPrefs: (change) => set({ library: { ...get().library, ...change } }),
  setFavourite: (key, favourite) => {
    const { marks } = get();
    set({ marks: { ...marks, favourites: { ...marks.favourites, [key]: favourite } } });
  },
  setMembership: (key, collectionId, member) => {
    const { marks } = get();
    const current = marks.memberships[key] ?? [];
    const next = member ? [...current.filter((id) => id !== collectionId), collectionId] : current.filter((id) => id !== collectionId);
    set({ marks: { ...marks, memberships: { ...marks.memberships, [key]: next } } });
  },
}));
