import type { KeyboardEvent } from "react";
import { cn } from "@giga/ui/lib/cn";
import { useSpotlightFrame } from "@/hooks/useSpotlightFrame";
import {
  SPOTLIGHT_LIST_ID,
  focusedItem,
  spotlightOptionId,
  type SpotlightAction,
  type SpotlightState,
} from "@/lib/spotlight-state";
import type { LibraryItem } from "@/types/library";
import { SpotlightBar } from "./SpotlightBar";
import { SpotlightResults } from "./SpotlightResults";

export interface TitleSpotlightProps {
  readonly state: SpotlightState;
  readonly dispatch: (action: SpotlightAction) => void;
  readonly paused: () => boolean;
  readonly onClose: () => void;
  readonly onType: (text: string) => void;
  readonly onSubmit: () => void;
  readonly onPlay: (item: LibraryItem) => void;
  readonly onInfo: (item: LibraryItem, opener: HTMLElement) => void;
}

/** Search titles (`06` section 4.6): macOS Spotlight, not a modal. One borderless rounded window floating over the
 *  app, with no scrim and no dimming of anything, no dialog semantics, no title bar and no close button. With nothing
 *  typed it is only the search bar; with a query it grows the two-column results (list and preview). It is dismissed
 *  by Escape, a press outside it or focus leaving it, and Title information stands over it without closing it. */
export function TitleSpotlight({ state, dispatch, paused, onClose, onType, onSubmit, onPlay, onInfo }: TitleSpotlightProps) {
  const panel = useSpotlightFrame(state.open, paused, onClose);
  const searched = state.query.trim() !== "";
  const listed = searched && !state.searching && state.results.length > 0;
  const focused = focusedItem(state);

  const onKey = (event: KeyboardEvent<HTMLDivElement>): void => {
    const inField = event.target instanceof HTMLInputElement;
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (step !== undefined) dispatch({ type: "move", by: step });
    else if (!inField && (event.key === "Home" || event.key === "End")) {
      dispatch({ type: "edge", to: event.key === "Home" ? "first" : "last" });
    } else if (inField && event.key === "Enter" && !event.nativeEvent.isComposing) onSubmit();
    else return;
    /* The keys are the spotlight's: the Library's own lists under it never hear them. */
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div
      ref={panel}
      data-spotlight
      className={cn(
        "fixed top-[22%] left-1/2 z-47 flex w-[760px] max-w-[calc(100vw-48px)] -translate-x-1/2 flex-col overflow-hidden",
        "rounded-2xl border border-border bg-panel font-sans shadow-[0_24px_80px_rgba(0,0,0,0.4)]",
      )}
      onKeyDown={onKey}
    >
      <SpotlightBar
        query={state.query} onType={onType}
        listId={listed ? SPOTLIGHT_LIST_ID : undefined}
        activeId={listed && focused !== undefined ? spotlightOptionId(focused) : undefined}
      />
      {searched && <SpotlightResults state={state} dispatch={dispatch} onPlay={onPlay} onInfo={onInfo} />}
    </div>
  );
}
