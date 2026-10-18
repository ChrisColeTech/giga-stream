// How a fake TMDB reads a discover request's date filters (docs/48): a year, or an inclusive range of days.
export type DiscoverKind = "movie" | "tv";

/** Whether the request's year and range filters take in `day` (`YYYY-MM-DD`); a request with none takes in every day. */
export function datedIn(url: URL, kind: DiscoverKind, day: string): boolean {
  const prefix = kind === "movie" ? "primary_release_date" : "first_air_date";
  const year = url.searchParams.get(kind === "movie" ? "primary_release_year" : "first_air_date_year");
  const from = url.searchParams.get(`${prefix}.gte`);
  const to = url.searchParams.get(`${prefix}.lte`);
  return (year === null || day.startsWith(year)) && (from === null || day >= from) && (to === null || day <= to);
}
