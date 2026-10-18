import type { KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { cn } from "@giga/ui/lib/cn";
import { useSpotlightFrame } from "@/hooks/useSpotlightFrame";
import { LIBRARY_COPY } from "@/lib/library-copy";
import type { SpotlightAction, SpotlightState } from "@/lib/spotlight-state";
import type { LibraryItem } from "@/types/library";
import { SpotlightBar } from "./SpotlightBar";

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

/** Search titles (`06` section 4.6): a Spotlight bar. One floating card near the top of the window over a light scrim;
 *  no title bar, no close button. It sits one layer under the work windows so Title information can stand over it,
 *  dimming it while it does. */
export function TitleSpotlight({ state, dispatch, paused, onClose, onType, onSubmit, onPlay, onInfo }: TitleSpotlightProps) {
  const panel = useSpotlightFrame(state.open, paused, onClose);

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

  return createPortal(
    <>
      <div data-spotlight-scrim aria-hidden className="fixed inset-0 z-46 bg-scrim/40" />
      <div
        ref={panel}
        role="dialog"
        aria-label={LIBRARY_COPY.searchTitles}
        data-spotlight
        className={cn(
          "fixed top-[14%] left-1/2 z-47 flex w-[640px] max-w-[90vw] -translate-x-1/2 flex-col overflow-hidden",
          "rounded-xl border border-border bg-panel font-sans shadow-[0_24px_64px_rgba(0,0,0,0.5)]",
          "transition-opacity duration-fade ease-linear",
          state.info !== null && "opacity-60",
        )}
        onKeyDown={onKey}
      >
        <SpotlightBar state={state} dispatch={dispatch} onType={onType} onPlay={onPlay} onInfo={onInfo} />
      </div>
    </>,
    document.body,
  );
}
