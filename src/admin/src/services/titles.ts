import { queryString, START_VIEW, type BrowseQuery, type SearchQuery } from "@/lib/title-query";
import { storedParams, type StoredQuery } from "@/lib/title-stored-query";
import { request } from "./api";
import { StoredPageLenientSchema, type StoredPage } from "./schemas/title-stored-schema";
import {
  TitleDeletedSchema,
  TitleDetailSchema,
  TitleListLenientSchema,
  TitleRowSchema,
  DeletedTitleListSchema,
  type AdminDeletedTitle,
  type AdminTitleDetail,
  type AdminTitleRow,
  type TitleList,
} from "./schemas/title-schema";
import type { RecordInput } from "./service-types";

/** The Titles routes (`37` section 4.1), REAL. Every read asks for the disabled titles (`includeDisabled=true`,
 *  honoured for an admin's token). A list or search page is read row by row: an unreadable row is dropped and counted.
 *  A save is a `PATCH` of the changed fields (`null` clears); `detail` reads the fields a list row lacks; `revert`
 *  drops an admin's edits and refetches from TMDB (`409 title.manual` for a title made by hand). With no TMDB token and
 *  no manual title a read is `503 tmdb.unavailable`, which arrives as that `ApiError`. Writes take the 256 KiB body
 *  limit (B3). A synced title that is deleted stays deleted: `listDeleted` reads them (`GET /api/titles/deleted`) and
 *  `restore` removes one's record (`DELETE /api/titles/deleted/:id`); it returns on the next browse or sync. */
export interface TitlesService {
  readonly list: (query?: BrowseQuery, signal?: AbortSignal) => Promise<TitleList>;
  readonly search: (query: SearchQuery, signal?: AbortSignal) => Promise<TitleList>;
  readonly detail: (id: string) => Promise<AdminTitleDetail>;
  readonly create: (input: RecordInput) => Promise<AdminTitleDetail>;
  readonly update: (id: string, patch: RecordInput) => Promise<AdminTitleDetail>;
  readonly remove: (id: string) => Promise<{ readonly id: string }>;
  readonly revert: (id: string) => Promise<AdminTitleDetail>;
  readonly listDeleted: () => Promise<readonly AdminDeletedTitle[]>;
  readonly restore: (id: string) => Promise<{ readonly id: string }>;
  /** `GET /api/titles/stored` (`docs/41` section 3.2): rows `offset` to `offset + limit` of the stored titles that match
   *  the query, never TMDB. Read row by row. A `signal` aborts the request (a newer query replaced it). */
  readonly listStored: (query: StoredQuery, offset: number, limit?: number, signal?: AbortSignal) => Promise<StoredPage>;
}

const path = (id: string): string => `/api/titles/${encodeURIComponent(id)}`;
const BROWSE_START: BrowseQuery = { kind: "all", sort: START_VIEW.sort, page: 1 };

async function page(url: string, signal?: AbortSignal): Promise<TitleList> {
  const answer = await request(url, TitleListLenientSchema, { area: "Title", ...(signal !== undefined && { signal }) });
  const items: AdminTitleRow[] = [];
  for (const row of answer.items) {
    const parsed = TitleRowSchema.safeParse(row);
    if (parsed.success) items.push(parsed.data);
  }
  return {
    items,
    page: answer.page,
    totalPages: answer.totalPages,
    totalResults: answer.totalResults,
    unreadable: answer.items.length - items.length,
  };
}

async function stored(query: StoredQuery, offset: number, limit?: number, signal?: AbortSignal): Promise<StoredPage> {
  const url = `/api/titles/stored?${storedParams(query, offset, limit)}`;
  const answer = await request(url, StoredPageLenientSchema, { area: "Title", ...(signal !== undefined && { signal }) });
  const items: AdminTitleRow[] = [];
  for (const row of answer.items) {
    const parsed = TitleRowSchema.safeParse(row);
    if (parsed.success) items.push(parsed.data);
  }
  return { ...answer, items, unreadable: answer.items.length - items.length };
}

export const titles: TitlesService = {
  listStored: stored,
  list: (query = BROWSE_START, signal) => page(`/api/titles?${queryString(query)}`, signal),
  search: (query, signal) => page(`/api/titles/search?${queryString(query)}`, signal),
  detail: (id) => request(`${path(id)}?includeDisabled=true`, TitleDetailSchema, { area: "Title" }),
  create: (input) => request("/api/titles", TitleDetailSchema, { method: "POST", body: input, area: "Title" }),
  update: (id, patch) => request(path(id), TitleDetailSchema, { method: "PATCH", body: patch, area: "Title" }),
  remove: (id) => request(path(id), TitleDeletedSchema, { method: "DELETE", area: "Title" }),
  revert: (id) => request(`${path(id)}/revert`, TitleDetailSchema, { method: "POST", area: "Title" }),
  listDeleted: async () => (await request("/api/titles/deleted", DeletedTitleListSchema, { area: "Title" })).items,
  restore: (id) =>
    request(`/api/titles/deleted/${encodeURIComponent(id)}`, TitleDeletedSchema, { method: "DELETE", area: "Title" }),
};
