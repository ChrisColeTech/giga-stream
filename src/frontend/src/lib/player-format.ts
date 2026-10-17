/** Pure formatting for the Player: clocks, runtimes, episode codes and progress fractions. No React, no storage. */

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const MS_PER_MINUTE = 60_000;

const pad2 = (value: number): string => String(value).padStart(2, "0");

/** A playback clock: `21:00`, or `1:21:00` from an hour. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / MS_PER_SECOND));
  const hours = Math.floor(total / SECONDS_PER_HOUR);
  const minutes = Math.floor((total % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const seconds = total % SECONDS_PER_MINUTE;
  return hours > 0 ? `${hours}:${pad2(minutes)}:${pad2(seconds)}` : `${minutes}:${pad2(seconds)}`;
}

/** A runtime: `2h 16m`, or `48m` under an hour. */
export function formatRuntime(ms: number): string {
  const minutes = Math.round(Math.max(0, ms) / MS_PER_MINUTE);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours}h ${rest}m` : `${rest}m`;
}

/** An episode code, as the tab subtitle shows it: `S01 E02`. */
export function formatEpisodeCode(season: number, episode: number): string {
  return `S${pad2(season)} E${pad2(episode)}`;
}

export interface EpisodeNumber {
  readonly season: number;
  readonly episode: number;
}

/** Reads `S01 E02` back into numbers; anything else is absent. */
export function parseEpisodeCode(code: string | undefined): EpisodeNumber | undefined {
  if (code === undefined) return undefined;
  const match = /^S(\d{1,3}) E(\d{1,3})$/.exec(code);
  if (match === null) return undefined;
  return { season: Number(match[1]), episode: Number(match[2]) };
}

/** The share of a progress bar that is filled, 0 to 1; absent when the duration is unknown. */
export function progressFraction(positionMs: number, durationMs: number | undefined): number | undefined {
  if (durationMs === undefined || durationMs <= 0) return undefined;
  return Math.min(1, Math.max(0, positionMs / durationMs));
}
