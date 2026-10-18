import {
  forQuery,
  keepOnly,
  NO_SELECTION,
  removeId,
  selectAllMatching,
  tickLoaded,
  tickRow,
  type ListSelection,
} from "@giga/ui/lib/list-selection";
import {
  acceptPage,
  dropPages,
  failPage,
  loadedRows,
  NO_PAGED,
  patchRow,
  removeRow,
  startPage,
  type PageAnswer,
  type StoredPaged,
} from "@/lib/title-paged";
import { START_STORED, storedKey, type StoredQuery } from "@/lib/title-stored-query";
import type { AdminTitleRow } from "@/services/schemas/title-schema";
import type { SliceGet, SliceSet } from "./slices/slice-host";
import type { TitlesStatus } from "./titles-slice";

/* The Titles tab's STORED list (`docs/41` sections 4.3, 4.4 and 5.2), a part of the Titles slice. Facts only. `mode` is
 * which list the tab shows (each keeps its own state when the other is shown). `query` is the run query and `typed` the
 * search field's text. `paged` holds the loaded pages. `selection` is the ticks BY ID (they outlive a page being left),
 * and `picked` the ticked rows themselves as they were last seen, so a bulk verb can plan over rows that are no longer
 * loaded. An answer is accepted only for the query it was asked for. */

export type TitlesMode = "stored" | "browse";

export interface StoredState {
  readonly mode: TitlesMode;
  readonly status: TitlesStatus;
  readonly query: StoredQuery;
  readonly typed: string;
  readonly paged: StoredPaged;
  readonly unreachable: boolean;
  readonly selection: ListSelection;
  readonly picked: Readonly<Record<string, AdminTitleRow>>;
}

export const NO_STORED: StoredState = {
  mode: "stored",
  status: "idle",
  query: START_STORED,
  typed: "",
  paged: NO_PAGED,
  unreachable: false,
  selection: NO_SELECTION,
  picked: {},
};

export interface TitlesStoredSlice {
  titlesStored: StoredState;
  storedReset: () => void;
  storedSetMode: (mode: TitlesMode) => void;
  storedType: (typed: string) => void;
  /** A new query: the pages go, the list starts again at the top; an all-matching selection of another query is dropped. */
  storedSetQuery: (query: StoredQuery) => void;
  storedStart: () => void;
  storedPageStart: (page: number) => void;
  /** A page answered for `key`; a late answer for another query is ignored. */
  storedPageLoaded: (key: string, page: number, answer: PageAnswer) => void;
  storedPageFailed: (key: string, page: number, unreachable: boolean) => void;
  /** Every page goes (the first and the visible ones are read again); the total and the counts stay. */
  storedInvalidate: () => void;
  /** The stored titles changed elsewhere (a Browse TMDB add): the list is read again the next time `Stored` is shown. */
  storedMarkStale: () => void;
  storedPatch: (row: AdminTitleRow) => void;
  storedRemove: (id: string) => void;
  storedTick: (row: AdminTitleRow, on: boolean) => void;
  storedTickLoaded: (on: boolean) => void;
  storedSelectAllMatching: () => void;
  /** After a bulk run: only these rows stay ticked. */
  storedKeepTicked: (rows: readonly AdminTitleRow[]) => void;
  storedMarkUnreachable: (unreachable: boolean) => void;
}

const byId = (rows: readonly AdminTitleRow[]): Record<string, AdminTitleRow> =>
  Object.fromEntries(rows.map((row) => [row.id, row]));

const without = (rows: Readonly<Record<string, AdminTitleRow>>, id: string): Record<string, AdminTitleRow> =>
  Object.fromEntries(Object.entries(rows).filter(([key]) => key !== id));

export function createTitlesStoredSlice(
  set: SliceSet<TitlesStoredSlice>,
  get: SliceGet<TitlesStoredSlice>,
): TitlesStoredSlice {
  const now = (): StoredState => get().titlesStored;
  const patch = (next: Partial<StoredState>): void => set({ titlesStored: { ...now(), ...next } });
  const current = (key: string): boolean => storedKey(now().query) === key;
  return {
    titlesStored: NO_STORED,
    storedReset: () => set({ titlesStored: NO_STORED }),
    storedSetMode: (mode) => patch({ mode }),
    storedType: (typed) => patch({ typed }),
    storedSetQuery: (query) =>
      patch({
        query,
        paged: NO_PAGED,
        status: "loading",
        selection: forQuery(now().selection, storedKey(query)),
      }),
    storedStart: () => patch({ status: "loading" }),
    storedPageStart: (page) => patch({ paged: startPage(now().paged, page) }),
    storedPageLoaded: (key, page, answer) => {
      if (!current(key)) return;
      patch({ status: "ready", unreachable: false, paged: acceptPage(now().paged, page, answer) });
    },
    storedPageFailed: (key, page, unreachable) => {
      if (!current(key)) return;
      patch({ status: now().paged.total === null ? "failed" : "ready", unreachable, paged: failPage(now().paged, page) });
    },
    storedInvalidate: () => patch({ paged: dropPages(now().paged) }),
    storedMarkStale: () => patch({ status: "idle" }),
    storedPatch: (row) => {
      const picked = now().picked[row.id] === undefined ? now().picked : { ...now().picked, [row.id]: row };
      patch({ paged: patchRow(now().paged, row), picked });
    },
    storedRemove: (id) =>
      patch({ paged: removeRow(now().paged, id), selection: removeId(now().selection, id), picked: without(now().picked, id) }),
    storedTick: (row, on) =>
      patch({
        selection: tickRow(now().selection, row.id, on),
        picked: on ? { ...now().picked, [row.id]: row } : without(now().picked, row.id),
      }),
    /* The `All` box: on adds every LOADED row to the ticks (the ones on other pages stay); off clears everything. */
    storedTickLoaded: (on) => {
      const rows = loadedRows(now().paged);
      if (!on) return patch({ selection: tickLoaded([], false), picked: {} });
      const selection = rows.reduce((next, row) => tickRow(next, row.id, true), now().selection);
      patch({ selection, picked: { ...now().picked, ...byId(rows) } });
    },
    storedSelectAllMatching: () => patch({ selection: selectAllMatching(storedKey(now().query)) }),
    storedKeepTicked: (rows) => patch({ selection: keepOnly(rows.map((row) => row.id)), picked: byId(rows) }),
    storedMarkUnreachable: (unreachable) => patch({ unreachable }),
  };
}
