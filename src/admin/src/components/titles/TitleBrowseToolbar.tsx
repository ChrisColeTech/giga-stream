import { QueryBar } from "@giga/ui/lists/QueryBar";
import { QuerySearch } from "@giga/ui/lists/QuerySearch";
import { QuerySelect } from "@giga/ui/lists/QuerySelect";
import { SortControl } from "@giga/ui/lists/SortControl";
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

/** THE BROWSE LIST'S QUERY ROW, the same grammar as the Stored list's (`01` section 9; `docs/41` section 6): the shared
 *  `QuerySearch` taking the row's width (TMDB is searched as you type), then the sort (TMDB's own orders, so no direction
 *  toggle) and the self-labelling Kind select, the filters the browse route takes (TMDB's discover list has no genre or
 *  year filter). A search, a kind or a sort change returns to page 1. */
export function TitleBrowseToolbar({ view, onType, onSearch, onKind, onSort }: TitleBrowseToolbarProps) {
  return (
    <QueryBar search={<QuerySearch label={SEARCH_LABEL} value={view.typed} onChange={onType} onSearch={onSearch} />}>
      <SortControl
        label="Sort"
        value={view.sort}
        options={SORT_OPTIONS}
        onChange={(sort) => {
          if (isTitleSort(sort)) onSort(sort);
        }}
      />
      <QuerySelect
        label="Kind"
        value={kindChoiceOf(view)}
        options={BROWSE_KIND_OPTIONS}
        onChange={(kind) => {
          if (isKindChoice(kind)) onKind(kind);
        }}
      />
    </QueryBar>
  );
}
