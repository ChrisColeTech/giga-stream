import { Search } from "lucide-react";
import { Input } from "@giga/ui/controls/Input";
import { Select } from "@giga/ui/controls/Select";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { cn } from "@giga/ui/lib/cn";
import { BROWSE_KIND_OPTIONS, SEARCH_LABEL, SORT_OPTIONS } from "@/constants/title-copy";
import {
  isKindChoice,
  isTitleSort,
  kindChoiceOf,
  type KindChoice,
  type TitleSort,
  type TitleView,
} from "@/lib/title-query";

export interface TitleBrowseToolbarProps {
  readonly view: TitleView;
  readonly onType: (text: string) => void;
  readonly onSearch: () => void;
  readonly onKind: (choice: KindChoice) => void;
  readonly onSort: (sort: TitleSort) => void;
}

/** THE BROWSE LIST'S FIRST ROW, the same grammar as the Stored list's (`01` section 9; `docs/41` section 6): one row of
 *  fields that wraps, the search field taking the row's width with its icon inside it (it carries `data-search`, so
 *  `Ctrl+F` focuses it; it runs on Enter, never as you type), then the Sort select and the Kind select, the filters the
 *  browse route takes (TMDB's discover list has no genre or year filter). No chips, no pills, no labelled rows. A
 *  search, a kind or a sort change returns to page 1. */
export function TitleBrowseToolbar({ view, onType, onSearch, onKind, onSort }: TitleBrowseToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Browse titles filters">
      <span className="relative min-w-[220px] flex-1">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-dim" />
        <Input
          type="search"
          value={view.typed}
          className={cn(FIELD_CONTROL, "pl-7!")}
          aria-label={SEARCH_LABEL}
          data-search=""
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => onType(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onSearch();
          }}
        />
      </span>
      <span className="w-[190px] flex-none">
        <Select
          value={view.sort}
          aria-label="Sort"
          className={FIELD_CONTROL}
          onChange={(event) => {
            if (isTitleSort(event.target.value)) onSort(event.target.value);
          }}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </span>
      <span className="w-[150px] flex-none">
        <Select
          value={kindChoiceOf(view)}
          aria-label="Kind"
          className={FIELD_CONTROL}
          onChange={(event) => {
            if (isKindChoice(event.target.value)) onKind(event.target.value);
          }}
        >
          {BROWSE_KIND_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </span>
    </div>
  );
}
