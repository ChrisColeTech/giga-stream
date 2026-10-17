import { appendEvent, type EventRow, type EventTone } from "../lib/event-log";
import { clampZoom } from "../lib/settings-zoom";
import type { AccentId } from "../controls/accent-swatches";
import type { MotionPreference } from "../hooks/useReduceMotion";
import type { ChromeKinds, ChromeSlice, ThemeChoice } from "./chrome-types";

export interface ChromeDefaults {
  readonly theme: ThemeChoice;
  readonly accent: AccentId;
  readonly motion: MotionPreference;
  readonly uiZoom: number;
}

export interface ChromeOptions<K extends ChromeKinds> {
  readonly defaults: ChromeDefaults;
  /** The area a notice's Events row carries when `say` names none. */
  readonly defaultArea: K["area"];
  /** The log's starting rows (a demo's fixture; the interface starts empty). */
  readonly events?: readonly EventRow<K["area"]>[];
  /** Defaults to `Date.now`; a test injects its clock. */
  readonly now?: () => number;
}

/** The setter a slice writes through: the store's own `set`, which merges. */
export type ChromeSet<K extends ChromeKinds> = (partial: Partial<ChromeSlice<K>>) => void;

/** The chrome fields and actions of one program's store (`docs/27` section 2, the chrome slice). It performs no I/O and
 *  holds no timer or promise; the program adds its own fields and any write-back on top of it. */
export function createChromeSlice<K extends ChromeKinds>(
  set: ChromeSet<K>,
  get: () => ChromeSlice<K>,
  options: ChromeOptions<K>,
): ChromeSlice<K> {
  const now = options.now ?? (() => Date.now());
  return {
    theme: options.defaults.theme,
    accent: options.defaults.accent,
    motion: options.defaults.motion,
    uiZoom: options.defaults.uiZoom,
    eventsOpen: false,
    events: options.events ?? [],
    notice: null,
    overlay: null,
    overlayAnchor: null,
    overlayItem: null,
    childBounds: {},
    folded: {},
    setTheme: (theme) => set({ theme }),
    setAccent: (accent) => set({ accent }),
    setMotion: (motion) => set({ motion }),
    setZoom: (uiZoom) => set({ uiZoom: clampZoom(uiZoom) }),
    toggleEvents: () => set({ eventsOpen: !get().eventsOpen }),
    openOverlay: (overlay, overlayAnchor = null, overlayItem = null) => set({ overlay, overlayAnchor, overlayItem }),
    closeOverlay: () => set({ overlay: null, overlayAnchor: null, overlayItem: null }),
    rememberChild: (key, box) => set({ childBounds: { ...get().childBounds, [key]: box } }),
    toggleFold: (id) => set({ folded: { ...get().folded, [id]: !get().folded[id] } }),
    say: (sentence, tone: EventTone = "info", area = options.defaultArea) => {
      const serial = (get().notice?.serial ?? 0) + 1;
      const at = now();
      const row = tone === "info" ? null : { id: `n-${serial}-${at}`, at, tone, area, sentence };
      const events = row === null ? {} : { events: appendEvent(get().events, row, at) };
      set({ notice: { sentence, tone, serial }, ...events });
    },
    clearEvents: () => set({ events: [] }),
    logEvent: (event) => set({ events: appendEvent(get().events, event, now()) }),
  };
}
