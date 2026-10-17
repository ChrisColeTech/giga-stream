import { LIBRARY_PAGE_SIZE, SKELETON_ROWS } from "@/lib/library-limits";

/** How many skeletons stand where the next page will land: the page's own size, so the placeholders fill exactly the
 *  space the cards then take. Rows are taller than cards, so the list is capped at the Library's row skeleton count. */
export function pagerSkeletonCount(view: "grid" | "list" | "rows"): number {
  return view === "list" ? Math.min(LIBRARY_PAGE_SIZE, SKELETON_ROWS) : LIBRARY_PAGE_SIZE;
}
