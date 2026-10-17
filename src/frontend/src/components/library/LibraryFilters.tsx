import { LayoutGrid, List, Rows3 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { FIELD_CONTROL } from "@/components/ui/Form";
import { Segmented } from "@/components/ui/Segmented";
import { LIBRARY_COPY, SORT_OPTIONS, WATCHED_OPTIONS } from "@/lib/library-copy";
import {
  FILTER_DEFAULTS,
  choiceOf,
  type LibraryQuery,
  type ListView,
  type SortKey,
  type WatchedFilter,
} from "@/lib/library-query";
import { useAppStore } from "@/store/app-store";
import { FilterSetting } from "./FilterSetting";
import { GenrePopover } from "./GenrePopover";
import { SearchField } from "./SearchField";

const SORT_KEYS: readonly SortKey[] = ["newest", "oldest", "az", "year", "trending"];
const WATCHED_KEYS: readonly WatchedFilter[] = ["all", "unwatched", "watching", "watched"];

export interface LibraryFiltersProps {
  readonly query: LibraryQuery;
  readonly view: ListView;
  readonly genres: readonly string[];
  readonly years: readonly number[];
  readonly onQuery: (change: Partial<LibraryQuery>) => void;
  readonly onView: (view: ListView) => void;
  readonly trending: boolean;
}

/** The right pane of Library, on LoRA Studio's gallery filter pane (components/gallery/ImageFilters.tsx): a stack of
 *  settings, each a label over its control, with Clear filters pinned at the foot. */
export function LibraryFilters({ query, view, genres, years, onQuery, onView, trending }: LibraryFiltersProps) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3">
      <FilterSetting label="Search">
        <SearchField value={query.search} onChange={(search) => onQuery({ search })} />
      </FilterSetting>
      <FilterSetting label="View">
        <Segmented<ListView>
          aria-label="View"
          equal
          options={[
            { value: "grid", label: "Grid", icon: <LayoutGrid className="size-3.5" /> },
            { value: "list", label: "List", icon: <List className="size-3.5" /> },
            { value: "rows", label: "Rows", icon: <Rows3 className="size-3.5" /> },
          ]}
          value={view}
          onChange={onView}
        />
      </FilterSetting>
      <FilterSetting label="Sort">
        <Select
          aria-label="Sort"
          className={FIELD_CONTROL}
          value={query.sort}
          onChange={(event) => onQuery({ sort: choiceOf(SORT_KEYS, event.target.value, "newest") })}
        >
          {[...SORT_OPTIONS, ...(trending ? [{ value: "trending" as const, label: "Trending" }] : [])].map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </FilterSetting>
      <FilterSetting label="Genre">
        <GenrePopover genres={genres} selected={query.genres} onChange={(next) => onQuery({ genres: next })} />
      </FilterSetting>
      <FilterSetting label="Year">
        <Select aria-label="Year" className={FIELD_CONTROL} value={query.year} onChange={(event) => onQuery({ year: event.target.value })}>
          <option value="">{LIBRARY_COPY.anyYear}</option>
          {years.map((year) => (
            <option key={year} value={String(year)}>
              {year}
            </option>
          ))}
        </Select>
      </FilterSetting>
      <FilterSetting label="Watched">
        <Select
          aria-label="Watched"
          className={FIELD_CONTROL}
          value={query.watched}
          onChange={(event) => onQuery({ watched: choiceOf(WATCHED_KEYS, event.target.value, "all") })}
        >
          {WATCHED_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </FilterSetting>
      </div>
      {/* Pinned under the scroller, as the left rail pins Manage collections. */}
      <div className="flex-none border-t border-hair p-2">
        <Button
          variant="ghost"
          full
          title="Clear every filter and return the sort to your default; the search stays"
          onClick={() => onQuery({ ...FILTER_DEFAULTS, sort: useAppStore.getState().library.librarySort })}
        >
          Clear filters
        </Button>
      </div>
    </div>
  );
}
