import { create } from "zustand";
import { DEFAULT_SURFACE, SIDES, SURFACES, SURFACE_ORDER, limitsOf, paneKey } from "@/constants/surfaces";
import { EVENT_ROWS } from "@/fixtures/events";
import { SETTINGS_VALUES } from "@/fixtures/settings";
import { navigationSlice, type NavigationSlice } from "./navigation-slice";
import type { Box } from "@giga/ui/lib/child-types";
import type { EventArea } from "@/types/events";
import type { LibraryPrefs, PlaybackPrefs } from "@/types/settings";
import type { CollectionRow } from "@/types/collection";
import type { ItemRef } from "@/types/library";
import type { OverlayId, PopupAnchor } from "@/types/overlays";
import type { PaneKey, PaneSide, Surface } from "@/types/shell";
import { createChromeSlice } from "@giga/ui/store/chrome-slice";
import type { ChromeKinds, ChromeSlice } from "@giga/ui/store/chrome-types";

/** The admin's kinds for the shared chrome slice (docs/27 section 3: the chrome slice is spread into one store). */
export interface AdminKinds extends ChromeKinds {
  area: EventArea;
  overlay: OverlayId;
  anchor: PopupAnchor;
  item: ItemRef;
  box: Box;
}

/** The one store (`01` section 6). Serializable shell state only: no nodes, refs, promises or timers.
 *  Nothing here reads or writes browser storage; persistence arrives with the fileserver's settings rows. */
export interface AppState extends NavigationSlice, ChromeSlice<AdminKinds> {
  surface: Surface;
  /** Committed visibility per pane. A pane a surface does not have is never in this record. */
  open: Partial<Record<PaneKey, boolean>>;
  /** Committed size per pane, in pixels. */
  sizes: Partial<Record<PaneKey, number>>;
  /** Bumped by every open change so the tween engine travels only for toggles, never for a drag. */
  openVersion: number;
  /** Every collection, as the library service reports them. Empty until that service is wired. */
  collections: readonly CollectionRow[];
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
  ...createChromeSlice<AdminKinds>(set, get, {
    defaults: { theme: "dark", accent: "amber", motion: "system", uiZoom: 1 },
    defaultArea: "Connection",
    events: EVENT_ROWS,
  }),
  surface: DEFAULT_SURFACE,
  ...initialPanes(),
  openVersion: 0,
  collections: [],
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

  ...navigationSlice(set, get),
  setPlayback: (change) => set({ playback: { ...get().playback, ...change } }),
  setLibraryPrefs: (change) => set({ library: { ...get().library, ...change } }),
  setFavourite: (key, favourite) => {
    const { marks } = get();
    set({ marks: { ...marks, favourites: { ...marks.favourites, [key]: favourite } } });
  },
  setMembership: (key, collectionId, member) => {
    const { marks } = get();
    const current = marks.memberships[key] ?? [];
    const others = current.filter((id) => id !== collectionId);
    const next = member ? [...others, collectionId] : others;
    set({ marks: { ...marks, memberships: { ...marks.memberships, [key]: next } } });
  },
}));
