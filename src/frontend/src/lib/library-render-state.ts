import type { Scope } from "@/lib/library-query";
import type { ResolvedItem } from "@/lib/library-marks";

export interface LibraryRenderState {
  readonly items: readonly ResolvedItem[];
  readonly titleRegionsLoading: boolean;
}

export function libraryRenderState(
  items: readonly ResolvedItem[],
  titlesAvailable: boolean,
  scope: Scope,
  requestPending = false,
): LibraryRenderState {
  if (titlesAvailable) return { items, titleRegionsLoading: false };
  return {
    items: items.filter((item) => item.kind === "local"),
    titleRegionsLoading: requestPending && scope !== "local",
  };
}

export function rowsRenderState(shelfCount: number, hasMore: boolean, paging: boolean, loading = false) {
  return { showSkeleton: shelfCount === 0 && loading, showPager: hasMore || paging };
}
