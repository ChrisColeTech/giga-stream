import { DISCOVER_FIRST_YEAR, DISCOVER_MIN_VOTES } from "../constants/limits.js";
import type { Kind } from "./title-shapes.js";

/**
 * One discover query's window of dates (docs/48 section 2): a calendar year (TMDB's year filter), or a range of days with
 * both ends inclusive and either end open. Open ends hold what the years do not: before the first year, after next year.
 */
export interface Slice {
  year?: number;
  from?: string;
  to?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const EARLIEST_DAY = "0001-01-01";
const LATEST_DAY = "9999-12-31";

const dayOf = (iso: string): number => Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);
const isoOf = (day: number): string => new Date(day * DAY_MS).toISOString().slice(0, 10);

/** A date range slice; an end that is `undefined` stays open. */
const range = (from: string | undefined, to: string | undefined): Slice => ({
  ...(from !== undefined && { from }),
  ...(to !== undefined && { to }),
});

/**
 * The slices of one walk, in order: everything before `DISCOVER_FIRST_YEAR`, one per year up to next calendar year (by the
 * injected clock), and everything after. Titles with no date match none of them and are not discovered.
 */
export function sliceList(now: () => number): Slice[] {
  const next = new Date(now()).getUTCFullYear() + 1;
  const slices: Slice[] = [range(undefined, `${DISCOVER_FIRST_YEAR - 1}-12-31`)];
  for (let year = DISCOVER_FIRST_YEAR; year <= next; year++) slices.push({ year });
  slices.push(range(`${next + 1}-01-01`, undefined));
  return slices;
}

/** The first and last day a slice covers (an open end is `undefined`). */
function boundsOf(slice: Slice): { lo?: string; hi?: string } {
  if (slice.year !== undefined) return { lo: `${slice.year}-01-01`, hi: `${slice.year}-12-31` };
  return { ...(slice.from !== undefined && { lo: slice.from }), ...(slice.to !== undefined && { hi: slice.to }) };
}

/**
 * Two slices that together cover exactly `slice`: `[a, mid]` and `[mid + 1 day, b]`. Both ends of a range are inclusive, so
 * the halves share no day. `undefined` for a single day, which cannot be split.
 */
export function splitSlice(slice: Slice): [Slice, Slice] | undefined {
  const { lo, hi } = boundsOf(slice);
  const first = dayOf(lo ?? EARLIEST_DAY);
  const last = dayOf(hi ?? LATEST_DAY);
  if (first >= last) return undefined;
  const mid = Math.floor((first + last) / 2);
  return [range(lo, isoOf(mid)), range(isoOf(mid + 1), hi)];
}

/** A short name for notes and errors: the year, or the range. */
export const labelOf = (slice: Slice): string =>
  slice.year !== undefined ? String(slice.year) : `${slice.from ?? "..."} to ${slice.to ?? "..."}`;

/** The query parameters of one page of a slice: popularity order, the vote floor and the slice's dates. */
export function sliceParams(kind: Kind, slice: Slice, page: number): Record<string, string | number> {
  const movie = kind === "movie";
  const params: Record<string, string | number> = { sort_by: "popularity.desc", "vote_count.gte": DISCOVER_MIN_VOTES, page };
  if (slice.year !== undefined) params[movie ? "primary_release_year" : "first_air_date_year"] = slice.year;
  const prefix = movie ? "primary_release_date" : "first_air_date";
  if (slice.from !== undefined) params[`${prefix}.gte`] = slice.from;
  if (slice.to !== undefined) params[`${prefix}.lte`] = slice.to;
  return params;
}
