import { AppError, ERRORS } from "../constants/errors.js";
import { PLAYLIST_SCHEDULE_MIN_MS } from "../constants/limits.js";
import { formatSchedule, parseSchedule } from "./title-shapes.js";

/** The interval a schedule means, or undefined for `"off"`. The stored text is always one this accepts. */
export const intervalOf = (schedule: string): number | undefined => parseSchedule(schedule);

/**
 * A schedule as it is stored: `parseSchedule` decides what is valid (`"500ms"`, `"45s"`, `"30m"`, `"6h"`, `"off"`),
 * and the text is written in its largest exact unit, so `"60m"` is `"1h"`. Anything else is `job.invalid`.
 */
export function normaliseSchedule(value: string, field = "schedule"): string {
  try {
    return formatSchedule(parseSchedule(value, field));
  } catch {
    throw new AppError(ERRORS.jobInvalid, { field }, 'The schedule must be a number and a unit (45s, 30m, 6h), or "off".');
  }
}

/** A playlist job's schedule may be "off" or at least 15 minutes: a web playlist is re-fetched on every run. */
export function normalisePlaylistSchedule(value: string): string {
  const schedule = normaliseSchedule(value);
  const interval = intervalOf(schedule);
  if (interval !== undefined && interval < PLAYLIST_SCHEDULE_MIN_MS) {
    throw new AppError(ERRORS.jobInvalid, { field: "schedule" }, 'A playlist job runs at most every 15 minutes (15m), or "off".');
  }
  return schedule;
}
