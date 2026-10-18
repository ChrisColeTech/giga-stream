import { LIBRARY_COPY } from "@/lib/library-copy";
import { BACKEND_UNREACHABLE_REASON, NO_TITLE_SOURCE_REASON } from "@/lib/player-copy";
import type { TitleDetail } from "@/types/title";

export interface TitlePlay {
  readonly playable: boolean;
  /** The disabled Play's tooltip; undefined while Play works. */
  readonly reason: string | undefined;
}

export const TITLE_LOADING_REASON = "Title information is loading.";

/** Whether Title information's **Play** works, and why not (`06` section 4.4). A series plays through its episodes, not
 *  the series payload (the backend fills streamUrl and sources on movies only), so a TV title is playable as soon as
 *  its information is read; the player resolves the episode. A detail answered from the fileserver's cache
 *  (`fromCache`, `46` section E) means the backend is not reachable, so nothing plays. */
export function titlePlay(kind: "movie" | "tv" | "local" | undefined, detail: TitleDetail | undefined): TitlePlay {
  if (kind === undefined) return { playable: false, reason: LIBRARY_COPY.noItem };
  if (kind === "local") return { playable: true, reason: undefined };
  if (detail === undefined) return { playable: false, reason: TITLE_LOADING_REASON };
  if (detail.fromCache === true) return { playable: false, reason: BACKEND_UNREACHABLE_REASON };
  const playable = kind === "tv" || detail.streamUrl !== undefined || (detail.sources?.length ?? 0) > 0;
  return { playable, reason: playable ? undefined : NO_TITLE_SOURCE_REASON };
}
