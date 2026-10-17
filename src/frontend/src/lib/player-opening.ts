import type { Progress } from "@/types/library";
import type { Settings } from "@/types/settings";

export function openingPosition(mode: Settings["resumeMode"], progress: Progress | undefined): number {
  return mode === "resume" && progress?.state === "watching" ? progress.positionMs : 0;
}

export function shouldAttemptPlay(autoplay: boolean, userInitiated: boolean): boolean {
  return userInitiated || autoplay;
}

export function applyOpeningPosition(media: { currentTime: number }, positionMs: number): void {
  if (positionMs > 0) media.currentTime = positionMs / 1000;
}

export interface PlayableMedia {
  play(): Promise<void>;
}

export function attemptPlayerPlay(
  media: PlayableMedia,
  autoplay: boolean,
  userInitiated: boolean,
  onRefused: () => void,
): void {
  if (!shouldAttemptPlay(autoplay, userInitiated)) return;
  void media.play().catch(onRefused);
}
