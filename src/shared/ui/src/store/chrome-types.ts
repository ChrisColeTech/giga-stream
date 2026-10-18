import type { AccentId } from "../controls/accent-swatches";
import type { MotionPreference } from "../hooks/useReduceMotion";
import type { EventInput, EventRow, EventTone } from "../lib/event-log";

export type ThemeChoice = "dark" | "light" | "system";

/** The statusbar's one notice line: an outcome or a refusal, as a sentence. `serial` re-announces an identical one. */
export interface Notice {
  readonly sentence: string;
  readonly tone: EventTone;
  readonly serial: number;
}

/** The kinds a program's chrome carries and the library does not define: its event areas, the overlay ids it opens,
 *  what an overlay hangs from, the item it is about and a child window's box. A program names its own. */
export interface ChromeKinds {
  readonly area: string;
  readonly overlay: string;
  readonly anchor: unknown;
  readonly item: unknown;
  readonly box: unknown;
}

/** The chrome fields every program's store shares. The program spreads the slice into its own single `create` call. */
export interface ChromeSlice<K extends ChromeKinds> {
  theme: ThemeChoice;
  accent: AccentId;
  motion: MotionPreference;
  uiZoom: number;
  eventsOpen: boolean;
  events: readonly EventRow<K["area"]>[];
  notice: Notice | null;
  overlay: K["overlay"] | null;
  overlayAnchor: K["anchor"] | null;
  overlayItem: K["item"] | null;
  childBounds: Readonly<Record<string, K["box"]>>;
  /** Which child windows were maximized, by window key, kept for the run (`36` section 8.4). */
  childMaximized: Readonly<Record<string, boolean>>;
  folded: Readonly<Record<string, boolean>>;
  setTheme: (theme: ThemeChoice) => void;
  setAccent: (accent: AccentId) => void;
  setMotion: (motion: MotionPreference) => void;
  setZoom: (uiZoom: number) => void;
  toggleEvents: () => void;
  openOverlay: (id: K["overlay"], anchor?: K["anchor"] | null, item?: K["item"] | null) => void;
  closeOverlay: () => void;
  rememberChild: (key: string, box: K["box"]) => void;
  rememberMaximized: (key: string, on: boolean) => void;
  toggleFold: (id: string) => void;
  /** A warn or an error is also a row of the events log; an info notice is not. `area` defaults to the program's. */
  say: (sentence: string, tone?: EventTone, area?: K["area"]) => void;
  clearEvents: () => void;
  logEvent: (event: EventInput<K["area"]>) => void;
}
