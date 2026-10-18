/* What the Titles list shows and how it is read (`37` section 4.2), pure. The view is the slice's: the page, the text
 * typed in the search field, the search that was RUN (on Enter or the button, never as you type), the ticked kinds and
 * the sort. A search, a kind change or a sort change returns to page 1; `Older` raises the page, `Newer` lowers it. */

export type TitleKind = "movie" | "tv";
export const TITLE_SORTS = ["newest", "oldest", "az", "year", "trending"] as const;
export type TitleSort = (typeof TITLE_SORTS)[number];

export interface TitleView {
  readonly page: number;
  /** What the search field holds. */
  readonly typed: string;
  /** The search that was run; "" reads the browse list. */
  readonly search: string;
  readonly kinds: readonly TitleKind[];
  readonly sort: TitleSort;
}

export const START_VIEW: TitleView = { page: 1, typed: "", search: "", kinds: ["movie", "tv"], sort: "newest" };

export const FIRST_PAGE = "This is the first page.";
export const LAST_PAGE = "This is the last page.";

/** `GET /api/titles`: one kind or both (`all`, two TMDB reads on the backend). */
export interface BrowseQuery {
  readonly kind: TitleKind | "all";
  readonly sort: TitleSort;
  readonly page: number;
}

/** `GET /api/titles/search`: one kind. */
export interface SearchQuery {
  readonly q: string;
  readonly kind: TitleKind;
  readonly page: number;
}

/** One request the list makes. */
export type TitleRead =
  | { readonly route: "browse"; readonly query: BrowseQuery }
  | { readonly route: "search"; readonly query: SearchQuery };

const KIND_ORDER: readonly TitleKind[] = ["movie", "tv"];

/** The reads of a view: the browse list (`kind=all` with both chips on, else the one kind), or one search per ticked
 *  kind (the search route takes one kind). */
export function titleReads(view: TitleView): TitleRead[] {
  const kinds = KIND_ORDER.filter((kind) => view.kinds.includes(kind));
  const q = view.search.trim();
  if (q === "") {
    const kind = kinds.length === 1 ? (kinds[0] ?? "movie") : "all";
    return [{ route: "browse", query: { kind, sort: view.sort, page: view.page } }];
  }
  return kinds.map((kind) => ({ route: "search", query: { q, kind, page: view.page } }));
}

/** A query as its URL's search part; every admin read asks for the disabled titles too (`includeDisabled=true`). */
export function queryString(query: BrowseQuery | SearchQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) params.set(key, String(value));
  params.set("includeDisabled", "true");
  return params.toString();
}

/** The field's text changed: nothing is read. */
export const typeSearch = (view: TitleView, typed: string): TitleView => ({ ...view, typed });

/** Enter or the search button: the typed text becomes the search, on page 1. */
export const runSearch = (view: TitleView): TitleView => ({ ...view, search: view.typed.trim(), page: 1 });

/** The Kind select's value: both kinds or one. */
export type KindChoice = "all" | TitleKind;

export const isKindChoice = (value: string): value is KindChoice =>
  value === "all" || value === "movie" || value === "tv";

export const kindChoiceOf = (view: TitleView): KindChoice =>
  view.kinds.length === 1 ? (view.kinds[0] ?? "all") : "all";

/** The Kind select changed: both kinds or one; page 1. The same choice changes nothing. */
export function withKind(view: TitleView, choice: KindChoice): TitleView {
  if (kindChoiceOf(view) === choice) return view;
  return { ...view, kinds: choice === "all" ? KIND_ORDER : [choice], page: 1 };
}

export const withSort = (view: TitleView, sort: TitleSort): TitleView => ({ ...view, sort, page: 1 });

export const older = (view: TitleView, totalPages: number): TitleView =>
  view.page >= totalPages ? view : { ...view, page: view.page + 1 };

export const newer = (view: TitleView): TitleView => (view.page <= 1 ? view : { ...view, page: view.page - 1 });

/** Why `Newer` and `Older` are disabled, or undefined. */
export function pagingReasons(page: number, totalPages: number): { newer?: string; older?: string } {
  return {
    ...(page <= 1 && { newer: FIRST_PAGE }),
    ...(page >= totalPages && { older: LAST_PAGE }),
  };
}

export const isTitleSort = (value: string): value is TitleSort => TITLE_SORTS.some((sort) => sort === value);
