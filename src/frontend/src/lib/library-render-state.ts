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
): LibraryRenderState {
  if (titlesAvailable) return { items, titleRegionsLoading: false };
  return {
    items: items.filter((item) => item.kind === "local"),
    titleRegionsLoading: scope !== "local",
  };
}

/** The items the rail's view keeps: History those with progress, Favorites those marked, otherwise all. */
export function shownItems(items: readonly ResolvedItem[], source: string): readonly ResolvedItem[] {
  if (source === "history") return items.filter((item) => item.progress !== undefined);
  if (source === "favorites") return items.filter((item) => item.favorite);
  return items;
}
