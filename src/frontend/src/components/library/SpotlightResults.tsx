import { LIBRARY_COPY } from "@/lib/library-copy";
import {
  SPOTLIGHT_LIST_ID,
  SPOTLIGHT_SKELETON_ROWS,
  focusedItem,
  spotlightGroups,
  type SpotlightAction,
  type SpotlightState,
} from "@/lib/spotlight-state";
import type { LibraryItem } from "@/types/library";
import { SpotlightPreview } from "./SpotlightPreview";
import { SpotlightRow } from "./SpotlightRow";
import { SpotlightSkeleton } from "./SpotlightSkeleton";

/** The list column is at most about ten 44px rows, then it scrolls inside the window. */
const LIST_MAX = 440;

export interface SpotlightResultsProps {
  readonly state: SpotlightState;
  readonly dispatch: (action: SpotlightAction) => void;
  readonly onPlay: (item: LibraryItem) => void;
  readonly onInfo: (item: LibraryItem, opener: HTMLElement) => void;
}

/** The results area of Search titles (`06` section 4.6), drawn only once there is a query: a hairline, then two columns
 *  as macOS 12's Spotlight: the list (about 320px) under small grey category headers, and the focused row's preview.
 *  While searching, and with nothing to list, both columns are skeletons in their own shape. */
export function SpotlightResults({ state, dispatch, onPlay, onInfo }: SpotlightResultsProps) {
  const waiting = state.searching || state.results.length === 0;
  const heading = { movie: LIBRARY_COPY.moviesHeading, tv: LIBRARY_COPY.seriesHeading };
  return (
    <div className="grid min-h-[300px] grid-cols-[320px_minmax(0,1fr)] border-t border-hair" aria-busy={state.searching}>
      <div className="min-h-0 overflow-y-auto border-r border-hair p-2" style={{ maxHeight: LIST_MAX }}>
        {waiting ? (
          <SpotlightSkeleton count={SPOTLIGHT_SKELETON_ROWS} />
        ) : (
          <div role="listbox" id={SPOTLIGHT_LIST_ID} aria-label={LIBRARY_COPY.searchResults} className="flex flex-col">
            {spotlightGroups(state.results).map((group) => (
              <div key={group.kind} role="group" aria-label={heading[group.kind]} className="flex flex-col">
                <span aria-hidden className="px-2 pt-2 pb-1 text-xs font-medium text-faint first:pt-0">
                  {heading[group.kind]}
                </span>
                {group.items.map((item, offset) => (
                  <SpotlightRow
                    key={`${item.ref.kind}:${item.ref.id}`}
                    item={item}
                    focused={group.start + offset === state.focused}
                    onHover={() => dispatch({ type: "focus", index: group.start + offset })}
                    onPlay={() => onPlay(item)}
                    onInfo={(opener) => onInfo(item, opener)}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
      <SpotlightPreview item={waiting ? undefined : focusedItem(state)} />
    </div>
  );
}
