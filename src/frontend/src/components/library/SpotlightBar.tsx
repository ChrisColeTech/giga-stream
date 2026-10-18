import { Search } from "lucide-react";
import { LIBRARY_COPY } from "@/lib/library-copy";
import { LIBRARY_FILTER_MAX } from "@/lib/library-restore";

export interface SpotlightBarProps {
  readonly query: string;
  readonly onType: (text: string) => void;
  /** The listbox this field controls, drawn only once there is a query. */
  readonly listId: string | undefined;
  /** The focused row's id: the field keeps the focus, the rows are its active descendant. */
  readonly activeId: string | undefined;
}

/** The Search titles field (`06` section 4.6): the first row of the window, Spotlight's bar. A leading magnifier and a
 *  large borderless input with no field box, no visible label and no placeholder text. */
export function SpotlightBar({ query, onType, listId, activeId }: SpotlightBarProps) {
  return (
    <div className="relative flex h-16 flex-none items-center">
      <Search className="pointer-events-none absolute left-5 size-6 text-faint" aria-hidden />
      <input
        autoFocus
        type="text"
        role="combobox"
        aria-expanded={listId !== undefined}
        aria-controls={listId}
        aria-activedescendant={activeId}
        aria-autocomplete="list"
        autoComplete="off"
        spellCheck={false}
        aria-label={LIBRARY_COPY.searchTitles}
        maxLength={LIBRARY_FILTER_MAX}
        value={query}
        onChange={(event) => onType(event.target.value)}
        className="size-full border-0 bg-transparent pr-5 pl-16 font-sans text-xl text-text outline-none"
      />
    </div>
  );
}
