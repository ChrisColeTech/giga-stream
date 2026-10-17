/** How far media time must move before another progress write is due (docs/30 section 3.2). Media time, not a clock:
 *  paused media writes nothing, and a seek this far, forward or back, writes at once. */
export const WATCH_WRITE_EVERY_MS = 10_000;

/** Whether a position that is `positionMs` is far enough from the last written one to write again. The first
 *  write of a playback (nothing written yet) is always due. */
export function writeDue(lastWrittenMs: number | undefined, positionMs: number): boolean {
  if (lastWrittenMs === undefined) return true;
  return Math.abs(positionMs - lastWrittenMs) >= WATCH_WRITE_EVERY_MS;
}
