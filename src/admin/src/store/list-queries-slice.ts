import { LIST_STARTS, type ListId } from "@/constants/list-query-copy";
import { startQuery, type ListQuery } from "@/lib/list-query";
import type { SliceGet, SliceSet } from "./slices/slice-host";

/* The query rows of the index lists the admin holds whole, a slice of the one store: what each list's search field
 * holds, the search that runs, its sort and its filters. They live here, not in the row components, so a query outlives
 * the tab being left and shown again. Facts only: no promise, no timer (the pause after typing is the shared field's). */

export type ListQueries = Readonly<Record<ListId, ListQuery>>;

export const START_QUERIES: ListQueries = {
  providers: startQuery(LIST_STARTS.providers),
  playlists: startQuery(LIST_STARTS.playlists),
  jobs: startQuery(LIST_STARTS.jobs),
  accounts: startQuery(LIST_STARTS.accounts),
  deleted: startQuery(LIST_STARTS.deleted),
};

export interface ListQueriesSlice {
  listQueries: ListQueries;
  /** Replaces one list's query. */
  listQuerySet: (list: ListId, query: ListQuery) => void;
}

export function createListQueriesSlice(
  set: SliceSet<ListQueriesSlice>,
  get: SliceGet<ListQueriesSlice>,
): ListQueriesSlice {
  return {
    listQueries: START_QUERIES,
    listQuerySet: (list, query) => set({ listQueries: { ...get().listQueries, [list]: query } }),
  };
}
