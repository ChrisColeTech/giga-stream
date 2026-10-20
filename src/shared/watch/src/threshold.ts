/**
 * The `watchedPercent` rule, applied at write time (docs/30 section 3.2): the server — or, on the
 * browser runtime, the local store — alone decides `watched`, from the position and duration the
 * write carries and the setting as it stands at that write. There is no constant: the percent is
 * always a passed-in argument, and the fileserver reads it from its `watchedPercent` setting at
 * each write (90 by default).
 */
import type { WatchState } from "./entry";

/**
 * A position past a known end is the end: a player's last tick can overshoot the duration by a
 * frame, and the stored position must never exceed the duration the progress bar divides by. A
 * write with no duration is stored as sent.
 */
export function clampPosition(positionMs: number, durationMs: number | undefined): number {
  return durationMs === undefined ? positionMs : Math.min(positionMs, durationMs);
}

/**
 * The state a write lands in. `watched` is sticky — an entry that ever crossed the threshold never
 * goes back to `watching`, whatever a later write carries (docs/30 section 3.2). Otherwise the
 * entry is `watched` once the position reaches the `watchedPercent` share of the duration
 * (`positionMs >= durationMs * watchedPercent / 100`, so the share itself counts). A write without
 * a duration cannot cross any threshold and stays `watching`.
 */
export function entryState(
  existing: WatchState | undefined,
  positionMs: number,
  durationMs: number | undefined,
  watchedPercent: number,
): WatchState {
  if (existing === "watched") return "watched";
  if (durationMs === undefined) return "watching";
  return positionMs >= (durationMs * watchedPercent) / 100 ? "watched" : "watching";
}
