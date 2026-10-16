import type { PlayerTab, StageState } from "@/types/player";

/** PHASE 1 FIXTURE: the Player's open tabs (`06` section 5.1). One movie, one series, one local file. */
export const PLAYER_TABS: readonly PlayerTab[] = [
  { id: "tab-matrix", ref: { kind: "title", id: "movie-603" }, kind: "movie", title: "The Matrix" },
  { id: "tab-bb", ref: { kind: "title", id: "tv-1396" }, kind: "tv", title: "Breaking Bad", subtitle: "S01 E02" },
  { id: "tab-local", ref: { kind: "local", id: "local-1" }, kind: "local", title: "Holiday footage" },
];

/** PHASE 1 FIXTURE: the tab that is active when the Player opens. */
export const ACTIVE_TAB_ID = "tab-bb";

/** PHASE 1 FIXTURE: each tab's stage. Nothing loads in phase 1, so every stage is idle. */
export const PLAYER_STAGE: Readonly<Record<string, StageState>> = {
  "tab-matrix": { kind: "idle" },
  "tab-bb": { kind: "idle" },
  "tab-local": { kind: "idle" },
};
