import type { KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";
import { IconButton } from "@giga/ui/controls/IconButton";
import { Input } from "@giga/ui/controls/Input";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { cn } from "@giga/ui/lib/cn";
import { POPUP_BORDER, POPUP_CLASSES, POPUP_PAD } from "@giga/ui/lib/popup-metrics";
import { SkeletonRows } from "@giga/ui/lists/SkeletonRows";
import { useSpotlightFrame } from "@/hooks/useSpotlightFrame";
import { LIBRARY_COPY } from "@/lib/library-copy";
import { LIBRARY_FILTER_MAX } from "@/lib/library-restore";
import { SPOTLIGHT_SKELETON_ROWS, type SpotlightAction, type SpotlightState } from "@/lib/spotlight-state";
import type { LibraryItem } from "@/types/library";
import { SpotlightRow } from "./SpotlightRow";

const WIDE = POPUP_CLASSES.wide;

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

/** Search titles (`06` section 4.6): a wide popup drawn as the family's `PopupPanel` (frame, title header with its edged
 *  X, a body capped at the wide class), one layer under the work windows so Title information can stand over it. */
export function TitleSpotlight({ state, dispatch, paused, onClose, onType, onSubmit, onPlay, onInfo }: TitleSpotlightProps) {
  const panel = useSpotlightFrame(state.open, paused, onClose);
  const empty = state.searching || state.results.length === 0;

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
    <div
      ref={panel}
      role="dialog"
      aria-label={LIBRARY_COPY.searchTitles}
      data-popup="wide"
      data-spotlight
      style={{ width: WIDE.width + 2 * (POPUP_PAD + POPUP_BORDER) }}
      className="fixed z-47 flex flex-col overflow-hidden rounded-card border border-border bg-panel font-sans shadow-menu"
      onKeyDown={onKey}
    >
      <div className="flex h-7 flex-none items-center gap-2 border-b border-hair pr-1 pl-2">
        <h2 className="m-0 min-w-0 flex-1 truncate font-sans text-xs font-semibold text-text">
          {LIBRARY_COPY.searchTitles}
        </h2>
        <IconButton bordered className="size-5.5" title={`Close ${LIBRARY_COPY.searchTitles}`}
          aria-label={`Close ${LIBRARY_COPY.searchTitles}`} onClick={onClose}>
          <X className="size-3.25" aria-hidden />
        </IconButton>
      </div>
      <div className="flex-none border-b border-hair p-2">
        <div className="relative flex min-w-0 items-center">
          <Search className="pointer-events-none absolute left-3 size-3.5 text-faint" aria-hidden />
          <Input
            autoFocus
            aria-label={LIBRARY_COPY.searchTitles}
            maxLength={LIBRARY_FILTER_MAX}
            value={state.query}
            onChange={(event) => onType(event.target.value)}
            className={cn(FIELD_CONTROL, "pl-8!")}
          />
        </div>
      </div>
      <div className="min-h-0 overflow-y-auto p-2" style={{ maxHeight: WIDE.body }} aria-busy={state.searching}>
        {empty ? (
          <SkeletonRows count={SPOTLIGHT_SKELETON_ROWS} />
        ) : (
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0" aria-label={LIBRARY_COPY.searchResults}>
            {state.results.map((item, index) => (
              <SpotlightRow
                key={`${item.ref.kind}:${item.ref.id}`}
                item={item}
                focused={index === state.focused}
                onHover={() => dispatch({ type: "focus", index })}
                onPlay={() => onPlay(item)}
                onInfo={(opener) => onInfo(item, opener)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>,
    document.body,
  );
}
