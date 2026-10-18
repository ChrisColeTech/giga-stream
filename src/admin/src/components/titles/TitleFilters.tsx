import { Search } from "lucide-react";
import { ChipGroup } from "@giga/ui/controls/ChipGroup";
import { IconButton } from "@giga/ui/controls/IconButton";
import { Input } from "@giga/ui/controls/Input";
import { Segmented } from "@giga/ui/controls/Segmented";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { Row } from "@giga/ui/form/Row";
import {
  KIND_CHIPS,
  KIND_FILTER_TIP,
  SEARCH_LABEL,
  SEARCH_TIP,
  SORT_OPTIONS,
  SORT_TIP,
} from "@/constants/title-copy";
import type { TitleKind, TitleSort, TitleView } from "@/lib/title-query";

export interface TitleFiltersProps {
  readonly view: TitleView;
  readonly onType: (text: string) => void;
  readonly onSearch: () => void;
  readonly onKind: (kind: TitleKind) => void;
  readonly onSort: (sort: TitleSort) => void;
}

const isKind = (value: string): value is TitleKind => value === "movie" || value === "tv";

/** The list's heading area (`37` section 4.2), in order: the search field (it carries `data-search`, so `Ctrl+F` focuses
 *  it; it runs on Enter and on its own button, never as you type), the Kind chips (at least one stays on) and the Sort
 *  pills. A search, a kind or a sort change returns to page 1. */
export function TitleFilters({ view, onType, onSearch, onKind, onSort }: TitleFiltersProps) {
  return (
    <>
      <Row
        label="Search"
        tip={SEARCH_TIP}
        trailing={
          <IconButton aria-label="Run the search" title="Search" onClick={onSearch}>
            <Search aria-hidden className="size-4" />
          </IconButton>
        }
      >
        <Input
          type="search"
          value={view.typed}
          className={FIELD_CONTROL}
          aria-label={SEARCH_LABEL}
          data-search=""
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => onType(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onSearch();
          }}
        />
      </Row>
      <Row label="Kind" tip={KIND_FILTER_TIP}>
        <ChipGroup
          field
          min={1}
          aria-label="Kind filter"
          options={KIND_CHIPS}
          selected={new Set(view.kinds)}
          onToggle={(value) => {
            if (isKind(value)) onKind(value);
          }}
        />
      </Row>
      <Row label="Sort" tip={SORT_TIP}>
        <Segmented field aria-label="Sort" options={SORT_OPTIONS} value={view.sort} onChange={onSort} />
      </Row>
    </>
  );
}
