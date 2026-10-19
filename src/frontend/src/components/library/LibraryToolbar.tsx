import { Filter, LayoutGrid, List, RefreshCw, Rows3, Search } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { Button } from "@giga/ui/controls/Button";
import { IconButton } from "@giga/ui/controls/IconButton";
import { ChoiceMenu } from "@/components/ui/ChoiceMenu";
import { PopupPanel } from "@/components/popups/PopupPanel";
import { LIBRARY_COPY, SORT_OPTIONS } from "@/lib/library-copy";
import { appliedFilters } from "@/lib/library-filter-state";
import type { LibraryQuery, ListView, SortKey } from "@/lib/library-query";
import { AppliedFilters } from "./AppliedFilters";

const VIEWS = [
  { value: "grid", label: "Grid", icon: LayoutGrid },
  { value: "list", label: "List", icon: List },
  { value: "rows", label: "Rows", icon: Rows3 },
] as const;

export interface LibraryToolbarProps {
  readonly query: LibraryQuery;
  readonly view: ListView;
  readonly trending: boolean;
  readonly filters: ReactNode;
  readonly loading: boolean;
  readonly onQuery: (change: Partial<LibraryQuery>) => void;
  readonly onView: (view: ListView) => void;
  readonly onRefresh: () => void;
  readonly onSearch: () => void;
}

/** Library operations: faceted filters, sort, view, refresh and title spotlight. */
export function LibraryToolbar(props: LibraryToolbarProps) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const sorts = [...SORT_OPTIONS, ...(props.trending ? [{ value: "trending" as const, label: "Trending" }] : [])];
  const count = appliedFilters(props.query).length;
  return (
    <div className="flex-none border-b border-hair">
      <div className="flex flex-wrap items-center gap-1 px-2 py-2">
        <Button ref={trigger} variant="ghost" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
          <Filter aria-hidden /> Filters · {count}
        </Button>
        <ChoiceMenu<SortKey> label="Sort" value={props.query.sort} options={sorts}
          onChange={(sort) => props.onQuery({ sort })} />
        <ChoiceMenu<ListView> label="View" value={props.view} options={VIEWS} onChange={props.onView} />
        <span className="min-w-0 flex-1" aria-hidden />
        <IconButton aria-label="Refresh Library" title="Refresh Library" onClick={props.onRefresh}>
          <RefreshCw className={props.loading ? "animate-spin" : undefined} aria-hidden />
        </IconButton>
        <IconButton aria-label={LIBRARY_COPY.searchTitles} title={LIBRARY_COPY.searchTitles} onClick={props.onSearch}>
          <Search aria-hidden />
        </IconButton>
      </div>
      <AppliedFilters query={props.query} onQuery={props.onQuery} />
      {open && trigger.current !== null && (
        <PopupPanel title="Filters" size="compact" policy="live" anchor={trigger.current} onClose={() => setOpen(false)}
          related={(node) => trigger.current?.contains(node) === true
            || (node instanceof Element && node.closest('[role="menu"]') !== null)}>
          <div className="h-[min(62vh,520px)]">{props.filters}</div>
        </PopupPanel>
      )}
    </div>
  );
}
