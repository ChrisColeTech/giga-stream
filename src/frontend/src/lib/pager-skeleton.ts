import { LIBRARY_PAGE_SIZE, SKELETON_ROWS } from "@/lib/library-limits";
import type { Scope } from "@/lib/library-query";

/** The mixed-kind server cursor returns one page total, regardless of how many media kinds are selected. */
export function pagerSkeletonCount(view: "grid" | "list" | "rows", _scope: Scope): number {
  if (view === "list") return Math.min(LIBRARY_PAGE_SIZE, SKELETON_ROWS);
  return LIBRARY_PAGE_SIZE;
}
