import { LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { RailSection } from "@/components/ui/RailSection";
import { SelectField } from "@/components/ui/SelectField";
import { Segmented } from "@/components/ui/Segmented";
import { LIBRARY_COPY, SORT_OPTIONS, WATCHED_OPTIONS } from "@/lib/library-copy";
import {
  FILTER_DEFAULTS,
  choiceOf,
  filtersAtDefault,
  type LibraryQuery,
  type ListView,
  type SortKey,
  type WatchedFilter,
} from "@/lib/library-query";
import { FilterSetting } from "./FilterSetting";
import { GenrePopover } from "./GenrePopover";
import { SearchField } from "./SearchField";

const SORT_KEYS: readonly SortKey[] = ["newest", "oldest", "az", "year"];
const WATCHED_KEYS: readonly WatchedFilter[] = ["all", "unwatched", "watching", "watched"];

export interface LibraryFiltersProps {
  readonly query: LibraryQuery;
  readonly view: ListView;
  readonly genres: readonly string[];
  readonly years: readonly number[];
  readonly onQuery: (change: Partial<LibraryQuery>) => void;
  readonly onView: (view: ListView) => void;
}

/** The right pane of Library: Search and view, then Filter. Each setting is a bold label over a 36 px control. */
export function LibraryFilters({ query, view, genres, years, onQuery, onView }: LibraryFiltersProps) {
  const yearOptions = [
    { value: "", label: LIBRARY_COPY.anyYear },
    ...years.map((year) => ({ value: String(year), label: String(year) })),
  ];
  const atDefault = filtersAtDefault(query);
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto py-1.5">
      <RailSection id="library.search-view" title="Search and view">
        <FilterSetting label="Search">
          <SearchField value={query.search} onChange={(search) => onQuery({ search })} />
        </FilterSetting>
        <FilterSetting label="View">
          <Segmented<ListView>
            aria-label="View"
            options={[
              { value: "grid", label: "Grid", icon: <LayoutGrid className="size-3.5" aria-hidden /> },
              { value: "list", label: "List", icon: <List className="size-3.5" aria-hidden /> },
            ]}
            value={view}
            onChange={onView}
            className="h-9 w-full [&>button]:h-full [&>button]:basis-0"
          />
        </FilterSetting>
        <FilterSetting label="Sort">
          <SelectField
            label="Sort"
            value={query.sort}
            options={SORT_OPTIONS}
            onChange={(value) => onQuery({ sort: choiceOf(SORT_KEYS, value, "newest") })}
            className="h-9!"
          />
        </FilterSetting>
      </RailSection>
      <RailSection id="library.filter" title="Filter">
        <FilterSetting label="Genre">
          <GenrePopover genres={genres} selected={query.genres} onChange={(next) => onQuery({ genres: next })} />
        </FilterSetting>
        <FilterSetting label="Year">
          <SelectField
            label="Year"
            value={query.year}
            options={yearOptions}
            onChange={(year) => onQuery({ year })}
            className="h-9!"
          />
        </FilterSetting>
        <FilterSetting label="Watched">
          <SelectField
            label="Watched"
            value={query.watched}
            options={WATCHED_OPTIONS}
            onChange={(value) => onQuery({ watched: choiceOf(WATCHED_KEYS, value, "all") })}
            className="h-9!"
          />
        </FilterSetting>
        <div className="px-1">
          <Button
            variant="ghost"
            full
            disabled={atDefault}
            title={atDefault ? LIBRARY_COPY.noFilter : undefined}
            onClick={() => onQuery({ ...FILTER_DEFAULTS })}
          >
            Clear filters
          </Button>
        </div>
      </RailSection>
    </div>
  );
}
