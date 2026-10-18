import { QueryBar } from "@giga/ui/lists/QueryBar";
import { QuerySearch } from "@giga/ui/lists/QuerySearch";
import { QuerySelect } from "@giga/ui/lists/QuerySelect";
import { SortControl } from "@giga/ui/lists/SortControl";
import {
  EDITED_SELECT,
  ENABLED_SELECT,
  KIND_SELECT,
  ORIGIN_SELECT,
  STORED_SEARCH_LABEL,
  STORED_SORT_LABEL,
  STORED_SORT_OPTIONS,
} from "@/constants/title-stored-copy";
import {
  flipDir,
  isStoredSort,
  withSortField,
  type StoredFlag,
  type StoredKind,
  type StoredOrigin,
  type StoredQuery,
} from "@/lib/title-stored-query";

export interface TitleStoredToolbarProps {
  readonly query: StoredQuery;
  readonly typed: string;
  readonly onType: (text: string) => void;
  readonly onSearch: () => void;
  readonly onChange: (change: (query: StoredQuery) => StoredQuery) => void;
}

/** THE STORED LIST'S QUERY ROW (`01` section 9; `docs/41` section 6), one compact line in the shared `QueryBar`: the
 *  search taking the row's width (it runs as you type), then the sort (its column and a direction toggle) and a
 *  self-labelling select each for Kind, Origin, Edited and Enabled: the name at rest, the value in the accent when set. A
 *  change is a new query: the list returns to the top. */
export function TitleStoredToolbar({ query, typed, onType, onSearch, onChange }: TitleStoredToolbarProps) {
  return (
    <QueryBar search={<QuerySearch label={STORED_SEARCH_LABEL} value={typed} onChange={onType} onSearch={onSearch} />}>
      <SortControl
        label={STORED_SORT_LABEL}
        value={query.sort}
        options={STORED_SORT_OPTIONS}
        onChange={(sort) => {
          if (isStoredSort(sort)) onChange((now) => withSortField(now, sort));
        }}
        direction={{ value: query.dir, onToggle: () => onChange(flipDir) }}
      />
      <QuerySelect
        label={KIND_SELECT.label}
        value={query.kind}
        options={KIND_SELECT.options}
        onChange={(kind: StoredKind) => onChange((now) => ({ ...now, kind }))}
      />
      <QuerySelect
        label={ORIGIN_SELECT.label}
        value={query.origin}
        options={ORIGIN_SELECT.options}
        onChange={(origin: StoredOrigin) => onChange((now) => ({ ...now, origin }))}
      />
      <QuerySelect
        label={EDITED_SELECT.label}
        value={query.edited}
        options={EDITED_SELECT.options}
        onChange={(edited: StoredFlag) => onChange((now) => ({ ...now, edited }))}
      />
      <QuerySelect
        label={ENABLED_SELECT.label}
        value={query.enabled}
        options={ENABLED_SELECT.options}
        onChange={(enabled: StoredFlag) => onChange((now) => ({ ...now, enabled }))}
      />
    </QueryBar>
  );
}
