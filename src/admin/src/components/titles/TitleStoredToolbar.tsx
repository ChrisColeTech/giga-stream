import { Search } from "lucide-react";
import { Input } from "@giga/ui/controls/Input";
import { Select } from "@giga/ui/controls/Select";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { cn } from "@giga/ui/lib/cn";
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

interface FieldSelect {
  readonly label: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
}

function Pick({ select, value, onPick }: { readonly select: FieldSelect; readonly value: string; readonly onPick: (value: string) => void }) {
  return (
    <span className="w-[150px] flex-none">
      <Select value={value} aria-label={select.label} className={FIELD_CONTROL} onChange={(event) => onPick(event.target.value)}>
        {select.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </span>
  );
}

/** THE STORED LIST'S FIRST ROW, drawn as LoRA Studio's `LibraryToolbar` draws its own (`01` section 9; `docs/41` section 6):
 *  one row of fields that wraps, the search field taking the row's width with its search icon inside it (it carries
 *  `data-search`, so `Ctrl+F` focuses it; it runs on Enter, never as you type), then the Sort select (the column and its
 *  direction) and a select each for Kind, Origin, Edited and Enabled. No chips, no pills, no labelled rows. A change is a
 *  new query: the list returns to the top. */
export function TitleStoredToolbar({ query, typed, onType, onSearch, onChange }: TitleStoredToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Stored titles filters">
      <span className="relative min-w-[220px] flex-1">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-dim" />
        <Input
          type="search"
          value={typed}
          className={cn(FIELD_CONTROL, "pl-7!")}
          aria-label={STORED_SEARCH_LABEL}
          data-search=""
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => onType(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onSearch();
          }}
        />
      </span>
      <span className="w-[190px] flex-none">
        <Select
          value={sortValueOf(query)}
          aria-label={STORED_SORT_LABEL}
          className={FIELD_CONTROL}
          onChange={(event) => onChange((now) => withSortValue(now, event.target.value))}
        >
          {STORED_SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </span>
      <Pick select={KIND_SELECT} value={query.kind} onPick={(kind) => onChange((now) => ({ ...now, kind: kind as StoredKind }))} />
      <Pick select={ORIGIN_SELECT} value={query.origin} onPick={(origin) => onChange((now) => ({ ...now, origin: origin as StoredOrigin }))} />
      <Pick select={EDITED_SELECT} value={query.edited} onPick={(edited) => onChange((now) => ({ ...now, edited: edited as StoredFlag }))} />
      <Pick select={ENABLED_SELECT} value={query.enabled} onPick={(enabled) => onChange((now) => ({ ...now, enabled: enabled as StoredFlag }))} />
    </div>
  );
}
