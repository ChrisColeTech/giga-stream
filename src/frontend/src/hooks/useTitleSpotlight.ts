import { useCallback, useEffect, useReducer, useRef } from "react";
import { playRef } from "@/components/library/library-service";
import { openTitleInfo } from "@/components/library/open-title-info";
import { LIBRARY_COPY } from "@/lib/library-copy";
import { DEFAULT_QUERY, type LibraryQuery } from "@/lib/library-query";
import {
  SPOTLIGHT_CLOSED,
  focusedItem,
  playFromSpotlight,
  spotlightReducer,
  type SpotlightAction,
  type SpotlightState,
} from "@/lib/spotlight-state";
import { LibrarySearchSession } from "@/services/library";
import { useAppStore } from "@/store/app-store";
import type { LibraryItem } from "@/types/library";

/** The catalog's titles, movies and series, by title: the Library's own read with `q` (the backend's title search). */
const titleQuery = (text: string): LibraryQuery => ({ ...DEFAULT_QUERY, source: "all", scope: "all", search: text });

export interface TitleSpotlight {
  readonly state: SpotlightState;
  readonly dispatch: (action: SpotlightAction) => void;
  readonly open: () => void;
  readonly close: () => void;
  /** Typing: searched through the Library's debounced search session (it owns the one pause; no timer here). */
  readonly type: (text: string) => void;
  /** Enter: plays the focused row, or searches at once when there is none. */
  readonly submit: () => void;
  readonly play: (item: LibraryItem) => void;
  readonly info: (item: LibraryItem, opener: HTMLElement | null) => void;
  /** True while Title information stands over the spotlight: nothing may dismiss it then. */
  readonly paused: () => boolean;
}

/** The Search titles spotlight of Library (`06` section 4.6): its state, its reads and its hand-offs. Leaving Library
 *  closes it, Title information over it included. */
export function useTitleSpotlight(active: boolean): TitleSpotlight {
  const [state, dispatch] = useReducer(spotlightReducer, SPOTLIGHT_CLOSED);
  const latest = useRef(state);
  latest.current = state;
  const opener = useRef<HTMLElement | null>(null);
  const session = useRef<LibrarySearchSession | null>(null);
  if (session.current === null) {
    session.current = new LibrarySearchSession(
      (answer) => {
        useAppStore.getState().rememberLibraryItems(answer.items);
        dispatch({ type: "results", items: answer.items });
      },
      (error) => {
        dispatch({ type: "failed" });
        useAppStore.getState().say(error instanceof Error ? error.message : LIBRARY_COPY.searchFailed, "warn");
      },
    );
  }

  /* Title information closed (its X or Escape): the spotlight is back in charge, as it was. */
  const overlay = useAppStore((store) => store.overlay);
  useEffect(() => {
    if (state.info !== null && overlay !== "title-info") dispatch({ type: "info-closed" });
  }, [overlay, state.info]);

  useEffect(() => {
    if (active) return;
    session.current?.cancel();
    dispatch({ type: "leave" });
  }, [active]);
  useEffect(() => () => session.current?.cancel(), []);

  /* The statusbar's bar reads the store (`50` section 2.3): the spotlight is busy exactly while its search runs, and
     the flag clears on results, failure, dismissal and unmount alike. */
  useEffect(() => {
    useAppStore.getState().setActivity("search", state.searching);
    return () => useAppStore.getState().setActivity("search", false);
  }, [state.searching]);

  const paused = useCallback(
    () => latest.current.info !== null || useAppStore.getState().overlay === "title-info", [],
  );

  const open = useCallback(() => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    session.current?.cancel();
    dispatch({ type: "open" });
  }, []);

  const close = useCallback(() => {
    if (paused()) return;
    session.current?.cancel();
    dispatch({ type: "close" });
    /* Focus goes back to the opener only when it was still in the spotlight (X, Escape), never away from a control an
       outside press just took it to. */
    const back = opener.current;
    const held = document.activeElement;
    const inSpotlight = held === null || held === document.body || held.closest("[data-spotlight]") !== null;
    if (inSpotlight && back !== null && document.contains(back)) back.focus({ preventScroll: true });
  }, [paused]);

  const type = useCallback((text: string) => {
    dispatch({ type: "query", query: text });
    if (text.trim() === "") {
      session.current?.cancel();
      return;
    }
    dispatch({ type: "searching" });
    session.current?.search(titleQuery(text.trim()));
  }, []);

  const play = useCallback((item: LibraryItem) => {
    session.current?.cancel();
    playFromSpotlight(item, playRef);
    dispatch({ type: "leave" });
  }, []);

  const submit = useCallback(() => {
    const current = latest.current;
    const item = focusedItem(current);
    if (item !== undefined && !current.searching) {
      play(item);
      return;
    }
    if (current.query.trim() === "") return;
    dispatch({ type: "searching" });
    session.current?.readNow(titleQuery(current.query.trim()));
  }, [play]);

  const info = useCallback((item: LibraryItem, from: HTMLElement | null) => {
    dispatch({ type: "info", ref: item.ref });
    openTitleInfo(item.ref, from);
  }, []);

  return { state, dispatch, open, close, type, submit, play, info, paused };
}
