/** Calendar days in UTC, for the Library update's date windows (docs/49): TMDB's date filters take `YYYY-MM-DD`. */
export const DAY_MS = 24 * 60 * 60 * 1000;

/** The UTC day a time falls on. */
export const isoDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** Whole days since the epoch of a `YYYY-MM-DD` day. */
export const dayNumber = (iso: string): number => Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);

/** The `YYYY-MM-DD` of a day number. */
export const dayIso = (day: number): string => isoDay(day * DAY_MS);
