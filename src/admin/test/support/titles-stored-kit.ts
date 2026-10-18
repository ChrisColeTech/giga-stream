import type { AdminTitleRow } from "@/services/schemas/title-schema";
import type { StoredPage } from "@/services/schemas/title-stored-schema";
import type { TitlesService } from "@/services/titles";
import type { StoredQuery } from "@/lib/title-stored-query";

/* Shared by the Titles tests: a stored row, a stored page in the backend's answer shape, and a fake `listStored` that
 * serves `count` generated rows by offset (it records every call). */

export const titleRowOf = (id: string, extra: Partial<AdminTitleRow> = {}): AdminTitleRow => ({
  id,
  kind: id.startsWith("tv") ? "tv" : "movie",
  title: `T ${id}`,
  year: 1999,
  rating: 7.5,
  state: "synced",
  enabled: true,
  ...extra,
});

export const INVENTORY = { movie: 3, tv: 2, manual: 1, edited: 1, disabled: 1 };

export const storedPage = (
  items: AdminTitleRow[],
  total: number,
  offset = 0,
  version = "5:1",
): StoredPage => ({ items, total, offset, limit: 100, inventory: INVENTORY, version, unreadable: 0 });

export const EMPTY_STORED: TitlesService["listStored"] = async () => storedPage([], 0);

const UNUSED = async (): Promise<never> => Promise.reject(new Error("unused"));

/** A `TitlesService` whose every call but the scripted ones rejects. */
export const serviceOf = (script: Partial<TitlesService>): TitlesService => ({
  list: UNUSED,
  search: UNUSED,
  detail: UNUSED,
  create: UNUSED,
  update: UNUSED,
  remove: async (id) => ({ id }),
  revert: UNUSED,
  listDeleted: async () => [],
  restore: UNUSED,
  listStored: EMPTY_STORED,
  ...script,
});

export interface StoredCall {
  readonly query: StoredQuery;
  readonly offset: number;
  readonly limit: number | undefined;
}

/** A store of `count` rows `movie-0` to `movie-<count - 1>`; every call is recorded. */
export function fakeStored(count: number, version = "5:1") {
  const calls: StoredCall[] = [];
  const listStored: TitlesService["listStored"] = async (query, offset, limit) => {
    calls.push({ query, offset, limit });
    const size = limit ?? 100;
    const items = Array.from({ length: Math.max(0, Math.min(size, count - offset)) }, (_, at) => titleRowOf(`movie-${offset + at}`));
    return storedPage(items, count, offset, version);
  };
  return { listStored, calls };
}
