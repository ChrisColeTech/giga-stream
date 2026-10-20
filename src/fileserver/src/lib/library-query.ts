import { z } from "zod";

import { LIBRARY_PAGE_SIZE, FACET_YEARS } from "../constants/library.js";
import type { TitleKind } from "../store/admin-title-repository.js";
import type { LibraryItem, LibraryMediaTypes } from "../types/library.js";
import { AppError } from "./app-error.js";

/** The library query as the service runs it (docs/03 section 3.5's parameter table). */
export interface LibraryQuery {
  view: "all" | "history" | "favorites" | "collection";
  collectionId?: string;
  types: LibraryMediaTypes;
  q?: string;
  sort: "newest" | "oldest" | "az" | "year" | "trending";
  genres: string[];
  year?: number;
  watched: "all" | "unwatched" | "watching" | "watched";
  cursor?: string;
}

/** The opaque paging cursor (03 section 3.5): offsets only, never a local path. Local files first, then cached titles. */
export interface LibraryCursor {
  localOffset: number;
  titleOffset: number;
}

const CursorSchema = z.object({
  localOffset: z.number().int().min(0),
  titleOffset: z.number().int().min(0).default(0),
});

/** The title kinds selected by the media list; `local` has no cached-title kind. */
export function titleKindsOf(types: LibraryMediaTypes): TitleKind[] {
  const kinds: TitleKind[] = [];
  for (const type of types) if (type !== "local") kinds.push(type);
  return kinds;
}

const invalidCursor = (): AppError => new AppError("library.invalid", 422, "That library page marker is not usable.");

export function encodeCursor(cursor: LibraryCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf-8").toString("base64url");
}

export function decodeCursor(cursor: string): LibraryCursor {
  let json: unknown;
  try {
    json = JSON.parse(Buffer.from(cursor, "base64url").toString("utf-8"));
  } catch {
    throw invalidCursor();
  }
  const parsed = CursorSchema.safeParse(json);
  if (!parsed.success) throw invalidCursor();
  return parsed.data;
}

/** A row's sort keys: the release year where one is known, and when a local file was found. */
export interface RowOrder {
  year?: number;
  /** A local file's found time, in Unix milliseconds. */
  foundAt?: number;
  /** A history row's watch time, in Unix milliseconds; the view's own order. */
  watchedAt?: number;
}

/** `q` and media membership decide which rows the list holds at all (docs/03 section 3.5). */
export function inList(item: LibraryItem, query: LibraryQuery): boolean {
  const q = query.q?.toLowerCase();
  if (q !== undefined && !item.title.toLowerCase().includes(q)) return false;
  if (!query.types.some((type) => type === item.kind)) return false;
  return true;
}

/** The genre, year and watched narrowing; a genre matches any, watched by the row's own progress. */
export function matchesFilters(item: LibraryItem, query: LibraryQuery): boolean {
  if (query.genres.length > 0 && !item.genres.some((genre) => query.genres.includes(genre))) return false;
  if (query.year !== undefined && item.year !== query.year) return false;
  switch (query.watched) {
    case "unwatched":
      return item.progress === undefined;
    case "watching":
      return item.progress?.state === "watching";
    case "watched":
      return item.progress?.state === "watched";
    default:
      return true;
  }
}

const yearKey = (order: RowOrder): number => order.year ?? 0;
const foundYear = (order: RowOrder): number => (order.foundAt === undefined ? 0 : new Date(order.foundAt).getUTCFullYear());
/** What "newest" compares: the year a title was released, the year a file was found (03 section 3.5). */
const recencyKey = (order: RowOrder): number => order.watchedAt ?? (foundYear(order) || yearKey(order));

/** The sorts (docs/03 section 3.5); `trending` keeps the caller's order, which puts locals after titles. */
export function orderRows<T>(
  rows: readonly T[],
  sort: LibraryQuery["sort"],
  orderOf: (row: T) => RowOrder,
  titleOf: (row: T) => string,
): T[] {
  const copy = [...rows];
  const byTitle = (a: T, b: T): number => titleOf(a).localeCompare(titleOf(b));
  const byRecency = (a: T, b: T, sign: number): number => {
    const left = orderOf(a);
    const right = orderOf(b);
    const keys = sign * (recencyKey(right) - recencyKey(left));
    if (keys !== 0) return keys;
    if (left.foundAt !== undefined && right.foundAt !== undefined) return sign * (right.foundAt - left.foundAt);
    return 0;
  };
  switch (sort) {
    case "az":
      return copy.sort(byTitle);
    case "oldest":
      return copy.sort((a, b) => byRecency(a, b, -1) || byTitle(a, b));
    case "year":
      return copy.sort((a, b) => yearKey(orderOf(b)) - yearKey(orderOf(a)) || byTitle(a, b));
    case "trending":
      return copy;
    default:
      return copy.sort((a, b) => byRecency(a, b, 1) || byTitle(a, b));
  }
}

/** One page out of a materialized list, with the cursor carrying the position (03 section 3.5). */
export function pageOf(
  items: readonly LibraryItem[],
  cursor: LibraryCursor | undefined,
): { items: LibraryItem[]; nextCursor?: string } {
  const offset = cursor?.localOffset ?? 0;
  const page = items.slice(offset, offset + LIBRARY_PAGE_SIZE);
  const next =
    offset + page.length < items.length
      ? encodeCursor({ localOffset: offset + page.length, titleOffset: 0 })
      : undefined;
  return { items: page, ...(next !== undefined && { nextCursor: next }) };
}

/** The list views' facets: what the list holds, with the chosen values kept listed (03 section 3.5). */
export function facetsOf(items: readonly LibraryItem[], query: LibraryQuery): { genres: string[]; years: number[] } {
  const genres = new Set<string>(query.genres);
  const years = new Set<number>(query.year !== undefined ? [query.year] : []);
  for (const item of items) {
    for (const genre of item.genres) genres.add(genre);
    if (item.year !== undefined) years.add(item.year);
  }
  return {
    genres: [...genres].sort((a, b) => a.localeCompare(b)),
    years: [...years].sort((a, b) => b - a),
  };
}

/** The `all` view's years facet: this year back `FACET_YEARS` (docs/03 section 3.5). */
export function yearFacets(now: () => number): number[] {
  const thisYear = new Date(now()).getUTCFullYear();
  return Array.from({ length: FACET_YEARS }, (_, back) => thisYear - back);
}
