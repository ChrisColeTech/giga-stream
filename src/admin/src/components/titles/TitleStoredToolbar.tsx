import { QuerySearch } from "@giga/ui/lists/QuerySearch";
import { QuerySelect } from "@giga/ui/lists/QuerySelect";
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
  sortValueOf,
  withSortValue,
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

/** THE STORED LIST'S FIRST ROW (`01` section 9; `docs/41` section 6), the controls handed to the table strip's query row
 *  and drawn in the shared `QuerySearch` and `QuerySelect` as LoRA Studio's `LibraryToolbar` draws its own: the search
 *  field taking the row's width (it runs on Enter, never as you type), then the Sort select (the column and its
 *  direction) and a select each for Kind, Origin, Edited and Enabled. A change is a new query: the list returns to the
 *  top. */
export function TitleStoredToolbar({ query, typed, onType, onSearch, onChange }: TitleStoredToolbarProps) {
  return (
    <>
      <QuerySearch label={STORED_SEARCH_LABEL} value={typed} onChange={onType} onEnter={onSearch} />
      <QuerySelect
        label={STORED_SORT_LABEL}
        value={sortValueOf(query)}
        options={STORED_SORT_OPTIONS}
        width="w-[190px]"
        onChange={(sort) => onChange((now) => withSortValue(now, sort))}
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
    </>
  );
}
