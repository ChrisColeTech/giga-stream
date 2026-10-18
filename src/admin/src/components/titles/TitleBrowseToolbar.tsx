import { QuerySearch } from "@giga/ui/lists/QuerySearch";
import { QuerySelect } from "@giga/ui/lists/QuerySelect";
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

/** THE BROWSE LIST'S FIRST ROW, the same grammar as the Stored list's (`01` section 9; `docs/41` section 6), handed to the
 *  table strip's query row: the shared `QuerySearch` taking the row's width (it runs on Enter, never as you type), then
 *  the Sort select and the Kind select, the filters the browse route takes (TMDB's discover list has no genre or year
 *  filter). A search, a kind or a sort change returns to page 1. */
export function TitleBrowseToolbar({ view, onType, onSearch, onKind, onSort }: TitleBrowseToolbarProps) {
  return (
    <>
      <QuerySearch label={SEARCH_LABEL} value={view.typed} onChange={onType} onEnter={onSearch} />
      <QuerySelect
        label="Sort"
        value={view.sort}
        options={SORT_OPTIONS}
        width="w-[190px]"
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
    </>
  );
}
