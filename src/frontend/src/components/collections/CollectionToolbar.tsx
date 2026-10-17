import { LayoutGrid, List, Search } from "lucide-react";
import { Input, Select } from "@/components/ui/Field";
import { FIELD_CONTROL } from "@/components/ui/Form";
import { Segmented } from "@/components/ui/Segmented";
import { cn } from "@/lib/cn";

/* LoRA Studio's index strip (components/library/LibraryToolbar.tsx): search, sort and the Grid / List switch as the
 * list's first row, never in the group heading. One delta: the search field has no placeholder, which this project bans;
 * its glyph and accessible name say what it is. */
export type CollectionSort = "name" | "items" | "folders";
export type CollectionView = "grid" | "list";

export const COLLECTION_SORTS: ReadonlyArray<{ value: CollectionSort; label: string }> = [
  { value: "name", label: "By name" },
  { value: "items", label: "Most items" },
  { value: "folders", label: "Most folders" },
];

export interface CollectionToolbarProps {
  readonly query: string;
  readonly onQuery: (query: string) => void;
  readonly sort: CollectionSort;
  readonly onSort: (sort: CollectionSort) => void;
  readonly view: CollectionView;
  readonly onView: (view: CollectionView) => void;
}

export function CollectionToolbar({ query, onQuery, sort, onSort, view, onView }: CollectionToolbarProps) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <span className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-dim" aria-hidden />
        <Input
          value={query}
          aria-label="Search collections"
          className={cn(FIELD_CONTROL, "pl-7!")}
          onChange={(event) => onQuery(event.target.value)}
        />
      </span>
      <span className="w-[240px] flex-none">
        <Select
          value={sort}
          aria-label="Sort collections"
          className={FIELD_CONTROL}
          onChange={(event) => onSort(COLLECTION_SORTS.find((option) => option.value === event.target.value)?.value ?? "name")}
        >
          {COLLECTION_SORTS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </span>
      <Segmented<CollectionView>
        aria-label="View"
        options={[
          { value: "grid", label: "Grid", icon: <LayoutGrid className="size-3.5" /> },
          { value: "list", label: "List", icon: <List className="size-3.5" /> },
        ]}
        value={view}
        onChange={onView}
      />
    </div>
  );
}
