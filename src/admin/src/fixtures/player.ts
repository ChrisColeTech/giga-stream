import type { PlayerTab, StageState } from "@/types/player";

/** PHASE 1 FIXTURE: the item open when the Player first shows (`06` section 5.1): Breaking Bad, at the episode it was
 *  left at. */
export const INITIAL_ITEM: PlayerTab = {
  id: "tv-1396",
  ref: { kind: "title", id: "tv-1396" },
  kind: "tv",
  title: "Breaking Bad",
  subtitle: "S01 E02",
};

/** PHASE 1 FIXTURE: each item's stage, keyed by the item's id (its reference id, as the Player opens it). Nothing loads
 *  in phase 1, so an item absent here is idle; the lecture recording's stage has failed, so the failure note can be
 *  seen. */
export const PLAYER_STAGE: Readonly<Record<string, StageState>> = {
  "local-2": { kind: "failed", reason: "The file could not be read. It may have moved since the last scan." },
};
