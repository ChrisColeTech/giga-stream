/** What the stage shows over the picture. Loading stays unobstructed; failures and an empty view draw a note. */
export type LiveStageState = "idle" | "loading" | "ready" | "failed" | "no-channels";

export function stageStateFor(channelCount: number): LiveStageState {
  return channelCount === 0 ? "no-channels" : "ready";
}
