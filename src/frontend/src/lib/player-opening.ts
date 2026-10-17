import type { Progress } from "@/types/library";
import type { Settings } from "@/types/settings";

export function openingPosition(mode: Settings["resumeMode"], progress: Progress | undefined): number {
  return mode === "resume" && progress?.state === "watching" ? progress.positionMs : 0;
}

/** The length a progress report carries (docs/30 section 3.2). The media's or provider's own length always wins. A
 *  provider's embedded player that reports a position without a length falls back to the title's TMDB runtime; the
 *  app's own player never does, since a live or unknown stream has no honest percentage. */
export function reportedDuration(
  reportedMs: number | undefined,
  source: { readonly kind: "embed" | "stream" } | undefined,
  runtimeMs: number | undefined,
): number | undefined {
  return reportedMs ?? (source?.kind === "embed" ? runtimeMs : undefined);
}

export function shouldAttemptPlay(autoplay: boolean, userInitiated: boolean): boolean {
  return userInitiated || autoplay;
}

/** Seeks to the saved position once the media is known. A live or unknown length (`Infinity`, `NaN`) has no position
 *  worth restoring, and a seek on it would only land at the live edge. */
export function applyOpeningPosition(media: { currentTime: number; duration?: number }, positionMs: number): void {
  if (positionMs <= 0) return;
  if (media.duration !== undefined && !Number.isFinite(media.duration)) return;
  media.currentTime = positionMs / 1000;
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
