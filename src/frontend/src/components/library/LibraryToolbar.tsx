import { LayoutGrid, List, RefreshCw, Rows3, Search } from "lucide-react";
import { ChoicePopover } from "@giga/ui/menus/ChoicePopover";
import { IconButton } from "@giga/ui/controls/IconButton";
import { LIBRARY_COPY } from "@/lib/library-copy";
import { mediaChoice } from "@/lib/library-media";
import type { LibraryQuery, ListView } from "@/lib/library-query";

const VIEWS = [
  { value: "grid", label: "Grid", icon: LayoutGrid },
  { value: "list", label: "List", icon: List },
  { value: "rows", label: "Rows", icon: Rows3 },
] as const;

export interface LibraryToolbarProps {
  readonly query: LibraryQuery;
  readonly view: ListView;
  readonly loading: boolean;
  readonly onQuery: (change: Partial<LibraryQuery>) => void;
  readonly onView: (view: ListView) => void;
  readonly onRefresh: () => void;
  readonly onSearch: () => void;
}

/** Library quick choices and operations, in the documented toolbar order. */
export function LibraryToolbar(props: LibraryToolbarProps) {
  return (
    <div className="flex flex-none flex-wrap items-center gap-1 border-b border-hair px-2 py-2">
      <ChoicePopover trigger="toolbar" {...mediaChoice(props.query.scope, (scope) => props.onQuery({ scope }))} />
      <ChoicePopover mode="single" label="View" trigger="toolbar" value={props.view} options={VIEWS}
        onChange={props.onView} />
      <span className="min-w-0 flex-1" aria-hidden />
      <IconButton aria-label="Refresh Library" title="Refresh Library" onClick={props.onRefresh}>
        <RefreshCw className={props.loading ? "animate-spin" : undefined} aria-hidden />
      </IconButton>
      <IconButton aria-label={LIBRARY_COPY.searchTitles} title={LIBRARY_COPY.searchTitles} onClick={props.onSearch}>
        <Search aria-hidden />
      </IconButton>
    </div>
  );
}
