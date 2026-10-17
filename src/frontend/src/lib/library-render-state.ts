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
