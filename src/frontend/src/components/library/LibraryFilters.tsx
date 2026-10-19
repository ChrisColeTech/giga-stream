import { Button } from "@giga/ui/controls/Button";
import { ChoicePopover } from "@giga/ui/menus/ChoicePopover";
import { LIBRARY_COPY, SORT_OPTIONS, WATCHED_OPTIONS } from "@/lib/library-copy";
import { isAllMedia, mediaChoice } from "@/lib/library-media";
import { CLEAR_FILTERS, type LibraryQuery } from "@/lib/library-query";
import { FilterSetting } from "./FilterSetting";
import { FilterField } from "./FilterField";

export interface LibraryFiltersProps {
  readonly query: LibraryQuery;
  readonly genres: readonly string[];
  readonly years: readonly number[];
  readonly trending: boolean;
  readonly onQuery: (change: Partial<LibraryQuery>) => void;
}

/** The right pane of Library, on LoRA Studio's gallery filter pane (components/gallery/ImageFilters.tsx): a stack of
 *  settings, each a label over its control, with Clear filters pinned at the foot. */
export function LibraryFilters({ query, genres, years, trending, onQuery }: LibraryFiltersProps) {
  const genreOptions = genres.map((genre) => ({ value: genre, label: genre }));
  const yearOptions = [{ value: "", label: LIBRARY_COPY.anyYear }, ...years.map((year) => ({
    value: String(year), label: String(year),
  }))];
  const sorts = [...SORT_OPTIONS, ...(trending ? [{ value: "trending" as const, label: "Trending" }] : [])];
  const clear = query.search === "" && isAllMedia(query.scope) && query.genres.length === 0
    && query.year === "" && query.watched === "all";
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3">
      <FilterSetting label="Title">
        <FilterField value={query.search} onChange={(search) => onQuery({ search })} />
      </FilterSetting>
      <FilterSetting label="Media">
        <ChoicePopover trigger="field" {...mediaChoice(query.scope, (scope) => onQuery({ scope }))} />
      </FilterSetting>
      <FilterSetting label="Genre">
        <ChoicePopover mode="multi" label="Genre" trigger="field" values={query.genres} options={genreOptions}
          summary={query.genres.length === 0 ? LIBRARY_COPY.anyGenre : query.genres.join(", ")}
          onChange={(genres) => onQuery({ genres })} />
      </FilterSetting>
      <FilterSetting label="Year">
        <ChoicePopover mode="single" label="Year" trigger="field" value={query.year} options={yearOptions}
          onChange={(year) => onQuery({ year })} />
      </FilterSetting>
      <FilterSetting label="Watched">
        <ChoicePopover mode="single" label="Watched" trigger="field" value={query.watched} options={WATCHED_OPTIONS}
          onChange={(watched) => onQuery({ watched })} />
      </FilterSetting>
      <FilterSetting label="Sort">
        <ChoicePopover mode="single" label="Sort" trigger="field" value={query.sort} options={sorts}
          onChange={(sort) => onQuery({ sort })} />
      </FilterSetting>
      </div>
      {/* Pinned under the scroller, as the left rail pins Manage collections. */}
      <div className="flex-none border-t border-hair p-2">
        <Button
          variant="ghost"
          full
          title="Clear every applied Library filter"
          reason={clear ? "There are no filters to clear." : undefined}
          onClick={() => onQuery(CLEAR_FILTERS)}
        >
          Clear filters
        </Button>
      </div>
    </div>
  );
}
