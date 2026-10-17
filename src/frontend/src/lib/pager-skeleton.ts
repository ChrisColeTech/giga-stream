import { LIBRARY_PAGE_SIZE, SKELETON_ROWS } from "@/lib/library-limits";
import type { Scope } from "@/lib/library-query";

/** The title kinds one page reads: the fileserver pages Movies and TV together under "All" and each other scope alone,
 *  taking one page of `LIBRARY_PAGE_SIZE` from every kind. */
const KINDS_ALL = 2;

/** How many skeletons stand where the next page will land: the page's own size per kind read, so the placeholders fill
 *  exactly the space the cards then take. Rows are taller than cards, so the list is capped at the Library's row
 *  skeleton count. */
export function pagerSkeletonCount(view: "grid" | "list" | "rows", scope: Scope): number {
  if (view === "list") return Math.min(LIBRARY_PAGE_SIZE, SKELETON_ROWS);
  return LIBRARY_PAGE_SIZE * (scope === "all" ? KINDS_ALL : 1);
}
