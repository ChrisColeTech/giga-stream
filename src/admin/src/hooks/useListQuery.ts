import { useMemo } from "react";
import type { SortDir } from "@giga/ui/lists/record-grid-sort";
import type { RecordSort } from "@giga/ui/lists/record-table-types";
import type { ListId } from "@/constants/list-query-copy";
import {
  pressHeading,
  visibleRows,
  withDirection,
  withFilter,
  withSearch,
  withSortKey,
  withTyped,
  type ListQuery,
  type ListSpec,
} from "@/lib/list-query";
import { useAppStore } from "@/store/app-store";

export interface ListQueryHandlers {
  /** A committed keystroke: the field's text is kept; nothing is filtered yet. */
  readonly type: (text: string) => void;
  /** The pause after typing, Enter or the clear: the typed text becomes the search. */
  readonly search: () => void;
  readonly filter: (id: string, value: string) => void;
  readonly sortKey: (key: string) => void;
  readonly direction: (dir: SortDir) => void;
}

export interface ListQueryView<T> {
  readonly query: ListQuery;
  /** The rows that pass the query, in its sort's order. */
  readonly visible: T[];
  readonly handlers: ListQueryHandlers;
  /** The table's heading sort, agreeing with the Sort select. */
  readonly sort: RecordSort;
}

export interface ListQueryArgs<T> {
  readonly list: ListId;
  /** Every row the list holds, in the order the list keeps. A stable array, so the filtered rows are not rebuilt. */
  readonly rows: readonly T[];
  readonly spec: ListSpec<T>;
  readonly idOf: (row: T) => string;
  /** A search or filter change leaves only the ticks of rows still shown: a hidden row is never acted on by a verb. */
  readonly retain: (keep: (id: string) => boolean) => void;
}

/** A held index list's query (`lib/list-query.ts`) in the one store: the filtered, sorted rows and the handlers the
 *  shared query row (`ListQueryBar`) and the table's headings call. A new search or filter drops the ticks of rows it
 *  hides. */
export function useListQuery<T>({ list, rows, spec, idOf, retain }: ListQueryArgs<T>): ListQueryView<T> {
  const query = useAppStore((state) => state.listQueries[list]);
  const store = useAppStore((state) => state.listQuerySet);
  const visible = useMemo(() => visibleRows(rows, query, spec), [rows, query, spec]);
  const current = (): ListQuery => useAppStore.getState().listQueries[list];

  const narrow = (next: ListQuery): void => {
    store(list, next);
    const keep = new Set(visibleRows(rows, next, spec).map(idOf));
    retain((id) => keep.has(id));
  };
  const handlers: ListQueryHandlers = {
    type: (text) => store(list, withTyped(current(), text)),
    search: () => {
      const next = withSearch(current());
      if (next.q !== current().q) narrow(next);
    },
    filter: (id, value) => narrow(withFilter(current(), id, value)),
    sortKey: (key) => store(list, withSortKey(current(), key)),
    direction: (dir) => store(list, withDirection(current(), dir)),
  };
  const sort: RecordSort = {
    state: query.sort,
    onSort: (key) => store(list, pressHeading(current(), key)),
  };
  return { query, visible, handlers, sort };
}
