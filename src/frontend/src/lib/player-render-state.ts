import type { PlayerSource } from "@/lib/player-sources";
import type { StageState } from "@/types/player";

export type PlayerStageRender = "idle" | "loading" | "awaiting-resume" | "no-source" | "native" | "embed" | "failed";

/** Chooses one truthful stage host. Native controls exist only when a native source is attached. */
export function playerStageRender(
  open: boolean,
  loading: boolean,
  source: PlayerSource | undefined,
  stage: StageState,
  awaitingResume = false,
): PlayerStageRender {
  if (!open) return "idle";
  if (loading) return "loading";
  if (awaitingResume) return "awaiting-resume";
  if (source === undefined) return "no-source";
  if (stage.kind === "failed") return "failed";
  return source.kind === "embed" ? "embed" : "native";
}
