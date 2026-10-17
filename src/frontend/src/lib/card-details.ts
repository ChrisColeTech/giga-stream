import { durationLabel, seasonsLabel } from "@/lib/library-facts";
import type { TitleDetail } from "@/types/title";

/** The badge's rating, one decimal (`7.142` is `7.1`). TMDB writes 0 for a title nobody has rated, so 0, a negative or a
 *  non-number is no rating and the badge is not drawn. */
export function ratingBadge(rating: number | undefined): string | undefined {
  if (rating === undefined || !Number.isFinite(rating) || rating <= 0) return undefined;
  return rating.toFixed(1);
}

/** The popover's rating line, `7.1 / 10`, or undefined when the title has none. */
export function ratingOutOfTen(rating: number | undefined): string | undefined {
  const badge = ratingBadge(rating);
  return badge === undefined ? undefined : `${badge} / 10`;
}

/** The kind line: `Movie`, or `2 seasons · 14 episodes` for a series whose seasons are known (`Series` until then). */
export function detailKindLine(detail: Pick<TitleDetail, "kind" | "seasons">): string {
  if (detail.kind === "movie") return "Movie";
  return detail.seasons === undefined || detail.seasons.length === 0 ? "Series" : seasonsLabel(detail.seasons);
}

/** The runtime line, `1 h 46 min`, or undefined when the runtime is not known (a series has none). */
export function detailRuntime(runtimeMs: number | undefined): string | undefined {
  return runtimeMs === undefined || runtimeMs <= 0 ? undefined : durationLabel(runtimeMs);
}

/** The popover's fact line: year, kind (with its seasons once the detail is read) and runtime, each only when real.
 *  Without the detail it falls back to what the card already knows: the year and `Movie` or `Series`. */
export function detailFacts(
  card: { readonly year?: number; readonly kind: "movie" | "tv" | "local" },
  detail: TitleDetail | undefined,
): string[] {
  const year = detail?.year ?? card.year;
  const kind = detail !== undefined ? detailKindLine(detail) : card.kind === "tv" ? "Series" : "Movie";
  const parts = [year === undefined ? undefined : String(year), kind, detailRuntime(detail?.runtimeMs)];
  return parts.filter((part): part is string => part !== undefined);
}
