/** What the stage shows over the picture. "ready" is the plain player; the other two draw a note over it, and the phase 1
 *  build only ever reaches "ready" or "no-channels". */
export type LiveStageState = "ready" | "failed" | "no-channels";

export function stageStateFor(channelCount: number): LiveStageState {
  return channelCount === 0 ? "no-channels" : "ready";
}
