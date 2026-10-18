import { Search } from "lucide-react";
import { LIBRARY_COPY } from "@/lib/library-copy";
import { LIBRARY_FILTER_MAX } from "@/lib/library-restore";
import { SPOTLIGHT_SKELETON_ROWS, type SpotlightAction, type SpotlightState } from "@/lib/spotlight-state";
import type { LibraryItem } from "@/types/library";
import { SpotlightRow } from "./SpotlightRow";
import { SpotlightSkeleton } from "./SpotlightSkeleton";

/** The list shows about eight 44px rows, then scrolls inside the card. */
const LIST_MAX = 8 * 44 + 8;

export interface SpotlightBarProps {
  readonly state: SpotlightState;
  readonly dispatch: (action: SpotlightAction) => void;
  readonly onType: (text: string) => void;
  readonly onPlay: (item: LibraryItem) => void;
  readonly onInfo: (item: LibraryItem, opener: HTMLElement) => void;
}

/** What is inside the Search titles card (`06` section 4.6): the search field as its first row, a hairline, then the
 *  flat result list, or skeleton rows while searching and while there is nothing to list. */
export function SpotlightBar({ state, dispatch, onType, onPlay, onInfo }: SpotlightBarProps) {
  const empty = state.searching || state.results.length === 0;
  return (
    <>
      <div className="relative flex h-12 flex-none items-center border-b border-hair">
        <Search className="pointer-events-none absolute left-4 size-4.5 text-faint" aria-hidden />
        <input
          autoFocus
          type="text"
          autoComplete="off"
          spellCheck={false}
          aria-label={LIBRARY_COPY.searchTitles}
          maxLength={LIBRARY_FILTER_MAX}
          value={state.query}
          onChange={(event) => onType(event.target.value)}
          className="size-full border-0 bg-transparent pr-4 pl-12 font-sans text-base text-text outline-none"
        />
      </div>
      <div className="min-h-0 overflow-y-auto p-1" style={{ maxHeight: LIST_MAX }} aria-busy={state.searching}>
        {empty ? (
          <SpotlightSkeleton count={SPOTLIGHT_SKELETON_ROWS} />
        ) : (
          <ul className="m-0 flex list-none flex-col p-0" aria-label={LIBRARY_COPY.searchResults}>
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
    </>
  );
}
