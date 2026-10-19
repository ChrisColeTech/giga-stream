import { Button } from "@giga/ui/controls/Button";
import { ChoicePicker } from "@/components/ui/ChoicePicker";
import { LIBRARY_COPY, SCOPE_OPTIONS, WATCHED_OPTIONS } from "@/lib/library-copy";
import { CLEAR_FILTERS, type LibraryQuery } from "@/lib/library-query";
import { FilterSetting } from "./FilterSetting";
import { GenrePopover } from "./GenrePopover";
import { FilterField } from "./FilterField";

export interface LibraryFiltersProps {
  readonly query: LibraryQuery;
  readonly genres: readonly string[];
  readonly years: readonly number[];
  readonly onQuery: (change: Partial<LibraryQuery>) => void;
}

/** The right pane of Library, on LoRA Studio's gallery filter pane (components/gallery/ImageFilters.tsx): a stack of
 *  settings, each a label over its control, with Clear filters pinned at the foot. */
export function LibraryFilters({ query, genres, years, onQuery }: LibraryFiltersProps) {
  const yearOptions = [{ value: "", label: LIBRARY_COPY.anyYear }, ...years.map((year) => ({
    value: String(year), label: String(year),
  }))];
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3">
      <FilterSetting label="Title">
        <FilterField value={query.search} onChange={(search) => onQuery({ search })} />
      </FilterSetting>
      <FilterSetting label="Media">
        <ChoicePicker label="Media" value={query.scope} options={SCOPE_OPTIONS}
          onChange={(scope) => onQuery({ scope })} />
      </FilterSetting>
      <FilterSetting label="Genre">
        <GenrePopover genres={genres} selected={query.genres} onChange={(next) => onQuery({ genres: next })} />
      </FilterSetting>
      <FilterSetting label="Year">
        <ChoicePicker label="Year" value={query.year} options={yearOptions} searchable
          onChange={(year) => onQuery({ year })} />
      </FilterSetting>
      <FilterSetting label="Watched">
        <ChoicePicker label="Watched" value={query.watched} options={WATCHED_OPTIONS}
          onChange={(watched) => onQuery({ watched })} />
      </FilterSetting>
      </div>
      {/* Pinned under the scroller, as the left rail pins Manage collections. */}
      <div className="flex-none border-t border-hair p-2">
        <Button
          variant="ghost"
          full
          title="Clear every applied Library filter"
          onClick={() => onQuery(CLEAR_FILTERS)}
        >
          Clear filters
        </Button>
      </div>
    </div>
  );
}
