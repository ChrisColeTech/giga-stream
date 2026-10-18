import type { ItemRef, LibraryItem } from "@/types/library";

/** The Search titles spotlight (`06` section 4.6) as a pure state machine. The hook that owns it does the reads, the
 *  focus and the store calls; this only says what the spotlight shows. */
export interface SpotlightState {
  readonly open: boolean;
  readonly query: string;
  /** A search for `query` is under way: the body draws row skeletons. */
  readonly searching: boolean;
  /** Titles only (movies and series); a local file is never a result. */
  readonly results: readonly LibraryItem[];
  /** The row the arrows move and Enter plays; -1 with no results. */
  readonly focused: number;
  /** The title whose Title information stands over the spotlight; while it does, the spotlight cannot be dismissed. */
  readonly info: ItemRef | null;
}

export type SpotlightAction =
  | { readonly type: "open" }
  /** A dismissal (X, Escape, an outside press). Refused while Title information stands over the spotlight. */
  | { readonly type: "close" }
  /** Library was left (a surface switch, a Play from anywhere): closes whatever stands over it. */
  | { readonly type: "leave" }
  | { readonly type: "query"; readonly query: string }
  | { readonly type: "searching" }
  | { readonly type: "results"; readonly items: readonly LibraryItem[] }
  | { readonly type: "failed" }
  | { readonly type: "move"; readonly by: number }
  | { readonly type: "edge"; readonly to: "first" | "last" }
  | { readonly type: "focus"; readonly index: number }
  | { readonly type: "info"; readonly ref: ItemRef }
  | { readonly type: "info-closed" };

/** Skeleton rows while a search runs, and while there is nothing to list (`06` section 2.1). */
export const SPOTLIGHT_SKELETON_ROWS = 6;

export const SPOTLIGHT_CLOSED: SpotlightState = {
  open: false, query: "", searching: false, results: [], focused: -1, info: null,
};

const titlesOnly = (items: readonly LibraryItem[]): LibraryItem[] => items.filter((item) => item.kind !== "local");
const clamp = (index: number, length: number): number => (length === 0 ? -1 : Math.max(0, Math.min(length - 1, index)));

export function spotlightReducer(state: SpotlightState, action: SpotlightAction): SpotlightState {
  switch (action.type) {
    case "open":
      return { ...SPOTLIGHT_CLOSED, open: true };
    case "close":
      return state.info !== null ? state : SPOTLIGHT_CLOSED;
    case "leave":
      return SPOTLIGHT_CLOSED;
    case "query":
      return action.query.trim() === ""
        ? { ...state, query: action.query, searching: false, results: [], focused: -1 }
        : { ...state, query: action.query };
    case "searching":
      return state.open ? { ...state, searching: true } : state;
    case "results": {
      if (!state.open) return state;
      const results = titlesOnly(action.items);
      return { ...state, searching: false, results, focused: results.length === 0 ? -1 : 0 };
    }
    case "failed":
      return { ...state, searching: false };
    case "move":
      return { ...state, focused: clamp(state.focused + action.by, state.results.length) };
    case "edge":
      return { ...state, focused: clamp(action.to === "first" ? 0 : state.results.length - 1, state.results.length) };
    case "focus":
      return { ...state, focused: clamp(action.index, state.results.length) };
    case "info":
      return state.open ? { ...state, info: action.ref } : state;
    case "info-closed":
      return { ...state, info: null };
  }
}

/** The row Enter would play: the focused one, if any. */
export function focusedItem(state: SpotlightState): LibraryItem | undefined {
  return state.focused < 0 ? undefined : state.results[state.focused];
}

/** A row's Play: the spotlight closes, Title information included, and the Player is asked to open the title, exactly
 *  as a Library card's Play asks (`requestPlay`). */
export function playFromSpotlight(item: LibraryItem, requestPlay: (ref: ItemRef) => void): SpotlightState {
  requestPlay(item.ref);
  return SPOTLIGHT_CLOSED;
}

/** The facts line of a result row: `1999 · Movie`, `2008 · Series`, or the kind alone with no year. */
export function spotlightFacts(item: LibraryItem, words: { readonly movie: string; readonly series: string }): string {
  const kind = item.kind === "tv" ? words.series : words.movie;
  return item.year === undefined ? kind : `${item.year} · ${kind}`;
}
