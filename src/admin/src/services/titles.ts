import { queryString, START_VIEW, type BrowseQuery, type SearchQuery } from "@/lib/title-query";
import { request } from "./api";
import {
  TitleDeletedSchema,
  TitleDetailSchema,
  TitleListLenientSchema,
  TitleRowSchema,
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
 *  limit (B3). */
export interface TitlesService {
  readonly list: (query?: BrowseQuery) => Promise<TitleList>;
  readonly search: (query: SearchQuery) => Promise<TitleList>;
  readonly detail: (id: string) => Promise<AdminTitleDetail>;
  readonly create: (input: RecordInput) => Promise<AdminTitleDetail>;
  readonly update: (id: string, patch: RecordInput) => Promise<AdminTitleDetail>;
  readonly remove: (id: string) => Promise<{ readonly id: string }>;
  readonly revert: (id: string) => Promise<AdminTitleDetail>;
}

const path = (id: string): string => `/api/titles/${encodeURIComponent(id)}`;
const BROWSE_START: BrowseQuery = { kind: "all", sort: START_VIEW.sort, page: 1 };

async function page(url: string): Promise<TitleList> {
  const answer = await request(url, TitleListLenientSchema, { area: "Title" });
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

export const titles: TitlesService = {
  list: (query = BROWSE_START) => page(`/api/titles?${queryString(query)}`),
  search: (query) => page(`/api/titles/search?${queryString(query)}`),
  detail: (id) => request(`${path(id)}?includeDisabled=true`, TitleDetailSchema, { area: "Title" }),
  create: (input) => request("/api/titles", TitleDetailSchema, { method: "POST", body: input, area: "Title" }),
  update: (id, patch) => request(path(id), TitleDetailSchema, { method: "PATCH", body: patch, area: "Title" }),
  remove: (id) => request(path(id), TitleDeletedSchema, { method: "DELETE", area: "Title" }),
  revert: (id) => request(`${path(id)}/revert`, TitleDetailSchema, { method: "POST", area: "Title" }),
};
