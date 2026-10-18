import type { TitlePage } from "@/lib/title-merge";
import { START_VIEW, type TitleView } from "@/lib/title-query";
import { pruneDeletedTicks, withoutDeleted } from "@/lib/title-restore";
import { pruneTitleTicks, upsertTitle, withoutTitle } from "@/lib/title-rows";
import type { AdminDeletedTitle, AdminTitleDetail, AdminTitleRow } from "@/services/schemas/title-schema";
import type { SliceGet, SliceSet } from "./slices/slice-host";

/* The Titles tab's data, a slice of the one store (`37` section 5). Facts only: no promise, no timer. `view` is what
 * the list shows (page, the typed and the run search, the kinds, the sort; not remembered across sessions); `shown` is
 * the view the items were read for, so a late answer for an older view is told apart. `detail` is the open
 * workspace's read of the fields a list row lacks. `session` is the sign-in serial the data belongs to (the load hook
 * resets the slice for a new session, as the session slice does not). */

export type TitlesStatus = "idle" | "loading" | "ready" | "failed";

export interface TitleDetailState {
  readonly id: string;
  readonly status: "loading" | "ready" | "failed";
  readonly value: AdminTitleDetail | null;
}

/** The Deleted titles group's data: the deleted synced titles and the ticked ones (`37` section 4.4). */
export interface DeletedTitlesState {
  readonly status: TitlesStatus;
  readonly items: readonly AdminDeletedTitle[];
  readonly ticked: readonly string[];
}

export const NO_DELETED: DeletedTitlesState = { status: "idle", items: [], ticked: [] };

export interface TitlesState {
  readonly deleted: DeletedTitlesState;
  readonly status: TitlesStatus;
  readonly items: readonly AdminTitleRow[];
  readonly unreachable: boolean;
  readonly ticked: readonly string[];
  readonly view: TitleView;
  readonly shown: TitleView | null;
  readonly totalPages: number;
  readonly detail: TitleDetailState | null;
  readonly session: number;
}

export const NO_TITLES: TitlesState = {
  deleted: NO_DELETED,
  status: "idle",
  items: [],
  unreachable: false,
  ticked: [],
  view: START_VIEW,
  shown: null,
  totalPages: 1,
  detail: null,
  session: 0,
};

export interface TitlesSlice {
  titles: TitlesState;
  titlesReset: (session: number) => void;
  /** The view changed (typing, a run search, a chip, a sort, a page) without reading yet. */
  titlesSetView: (view: TitleView) => void;
  titlesStartLoad: () => void;
  /** A page answered for `view`: it replaces the items and keeps the ticks of rows still on the page. */
  titlesLoaded: (view: TitleView, page: TitlePage) => void;
  /** A read failed: the rows stay only when they belong to the view being read; otherwise the skeleton draws. */
  titlesLoadFailed: (view: TitleView, unreachable: boolean) => void;
  titleUpsert: (title: AdminTitleRow) => void;
  titleRemove: (id: string) => void;
  /** A Browse TMDB row was added to the store: it reads `stored` (and dims) without reading TMDB again. */
  titleMarkStored: (id: string) => void;
  /** A synced title was deleted from the store: its Browse TMDB row stays and reads `deleted` (dimmed), as the next read of
   *  TMDB would show it. The row is not removed: TMDB still has the title. */
  titleMarkDeleted: (id: string) => void;
  titleTick: (id: string, on: boolean) => void;
  titlesTickAll: (on: boolean) => void;
  titlesSetTicked: (ids: readonly string[]) => void;
  titlesMarkUnreachable: (unreachable: boolean) => void;
  titleDetailStart: (id: string) => void;
  /** A detail answered (a read, a save, a revert); it is kept only for the workspace that asked. */
  titleDetailLoaded: (detail: AdminTitleDetail) => void;
  titleDetailFailed: (id: string) => void;
  titlesDeletedStart: () => void;
  /** The deleted list answered: it replaces the rows and keeps the ticks of rows still listed. */
  titlesDeletedLoaded: (items: readonly AdminDeletedTitle[]) => void;
  titlesDeletedFailed: () => void;
  titleDeletedTick: (id: string, on: boolean) => void;
  titlesDeletedTickAll: (on: boolean) => void;
  titlesDeletedSetTicked: (ids: readonly string[]) => void;
  /** A restored title leaves the list (and its tick). */
  titleDeletedRemove: (id: string) => void;
}

export function createTitlesSlice(set: SliceSet<TitlesSlice>, get: SliceGet<TitlesSlice>): TitlesSlice {
  const now = (): TitlesState => get().titles;
  const patch = (next: Partial<TitlesState>): void => set({ titles: { ...now(), ...next } });
  const patchDeleted = (next: Partial<DeletedTitlesState>): void => patch({ deleted: { ...now().deleted, ...next } });
  const withItems = (items: readonly AdminTitleRow[]): Partial<TitlesState> => ({
    items,
    ticked: pruneTitleTicks(now().ticked, items),
  });
  return {
    titles: NO_TITLES,
    titlesReset: (session) => set({ titles: { ...NO_TITLES, session } }),
    titlesSetView: (view) => patch({ view }),
    titlesStartLoad: () => patch({ status: "loading" }),
    titlesLoaded: (view, page) => {
      const totalPages = Math.max(1, page.totalPages);
      patch({ status: "ready", unreachable: false, shown: view, totalPages, ...withItems(page.items) });
    },
    titlesLoadFailed: (view, unreachable) => {
      const keep = now().shown === view;
      patch({ status: "failed", unreachable, ...(keep ? {} : { shown: null, ...withItems([]) }) });
    },
    titleUpsert: (title) => patch(withItems(upsertTitle(now().items, title))),
    titleRemove: (id) => patch(withItems(withoutTitle(now().items, id))),
    titleMarkStored: (id) =>
      patch({ items: now().items.map((item) => (item.id === id ? { ...item, stored: true } : item)) }),
    titleMarkDeleted: (id) =>
      patch({
        items: now().items.map((item) => (item.id === id ? { ...item, stored: false, deleted: true } : item)),
      }),
    titleTick: (id, on) => {
      const rest = now().ticked.filter((one) => one !== id);
      patch({ ticked: on ? [...rest, id] : rest });
    },
    titlesTickAll: (on) => patch({ ticked: on ? now().items.map((item) => item.id) : [] }),
    titlesSetTicked: (ids) => patch({ ticked: pruneTitleTicks(ids, now().items) }),
    titlesMarkUnreachable: (unreachable) => patch({ unreachable }),
    titleDetailStart: (id) => {
      const kept = now().detail?.id === id ? (now().detail?.value ?? null) : null;
      patch({ detail: { id, status: "loading", value: kept } });
    },
    titleDetailLoaded: (detail) => {
      if (now().detail?.id !== detail.id) return;
      patch({ detail: { id: detail.id, status: "ready", value: detail } });
    },
    titleDetailFailed: (id) => {
      const current = now().detail;
      if (current?.id === id) patch({ detail: { ...current, status: "failed" } });
    },
    titlesDeletedStart: () => patchDeleted({ status: "loading" }),
    titlesDeletedLoaded: (items) =>
      patchDeleted({ status: "ready", items, ticked: pruneDeletedTicks(now().deleted.ticked, items) }),
    titlesDeletedFailed: () => patchDeleted({ status: "failed" }),
    titleDeletedTick: (id, on) => {
      const rest = now().deleted.ticked.filter((one) => one !== id);
      patchDeleted({ ticked: on ? [...rest, id] : rest });
    },
    titlesDeletedTickAll: (on) => patchDeleted({ ticked: on ? now().deleted.items.map((item) => item.id) : [] }),
    titlesDeletedSetTicked: (ids) => patchDeleted({ ticked: pruneDeletedTicks(ids, now().deleted.items) }),
    titleDeletedRemove: (id) => {
      const items = withoutDeleted(now().deleted.items, [id]);
      patchDeleted({ items, ticked: pruneDeletedTicks(now().deleted.ticked, items) });
    },
  };
}
