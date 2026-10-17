import type { PlayerSource } from "@/lib/player-sources";
import type { StageState } from "@/types/player";

export type PlayerStageRender =
  | "idle"
  | "loading"
  | "awaiting-resume"
  | "choose-episode"
  | "unavailable"
  | "no-source"
  | "native"
  | "native-failed"
  | "embed"
  | "embed-failed";

/** Chooses the active media host; pending/idle states keep the source-less player on the dark stage. */
export function playerStageRender(
  open: boolean,
  loading: boolean,
  source: PlayerSource | undefined,
  stage: StageState,
  awaitingResume = false,
  playableUnitSelected = true,
  playableUnitResolved = true,
): PlayerStageRender {
  if (!open) return "idle";
  if (loading) return "loading";
  if (awaitingResume) return "awaiting-resume";
  if (!playableUnitSelected) return "choose-episode";
  if (!playableUnitResolved) return "unavailable";
  if (source === undefined) return "no-source";
  if (stage.kind === "failed") return source.kind === "embed" ? "embed-failed" : "native-failed";
  return source.kind === "embed" ? "embed" : "native";
}
