import { LIBRARY_COPY, SCOPE_OPTIONS, WATCHED_OPTIONS } from "@/lib/library-copy";
import type { LibraryQuery } from "@/lib/library-query";

export interface AppliedFilter {
  readonly key: string;
  readonly label: string;
  readonly remove: Partial<LibraryQuery>;
}

/** Every non-default narrowing value, in the same order as the filter pane. */
export function appliedFilters(query: LibraryQuery): AppliedFilter[] {
  const filters: AppliedFilter[] = [];
  if (query.search !== "") filters.push({ key: "search", label: `Title: ${query.search}`, remove: { search: "" } });
  if (query.scope !== "all") {
    const label = SCOPE_OPTIONS.find((option) => option.value === query.scope)?.label ?? query.scope;
    filters.push({ key: "media", label: `Media: ${label}`, remove: { scope: "all" } });
  }
  for (const genre of query.genres) {
    filters.push({
      key: `genre:${genre}`,
      label: `Genre: ${genre}`,
      remove: { genres: query.genres.filter((item) => item !== genre) },
    });
  }
  if (query.year !== "") filters.push({ key: "year", label: `Year: ${query.year}`, remove: { year: "" } });
  if (query.watched !== "all") {
    const label = WATCHED_OPTIONS.find((option) => option.value === query.watched)?.label ?? query.watched;
    filters.push({ key: "watched", label: `${LIBRARY_COPY.watched}: ${label}`, remove: { watched: "all" } });
  }
  return filters;
}
