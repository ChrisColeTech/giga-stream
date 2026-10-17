/* The value rules a page checks itself before it sends anything (`28` section 7.3). Pure: each answers the refusal as a
 * sentence for the row's `error`, the notice line and `aria-invalid`, or null when the value passes. An empty value passes
 * every rule except `required`: whether a field may be empty is the page's own list of required fields. */

export const NUMBER_MIN = 1;
export const NUMBER_MAX = 9999;
export const YEAR_MIN = 1888;
export const YEAR_MAX = 2100;
export const RATING_MAX = 10;

/** The refusal sentence, or null. */
export type Refusal = string | null;

const WHOLE = /^\d+$/;
const DECIMAL = /^\d+(\.\d+)?$/;
const SCHEDULE = /^[1-9]\d*[mh]$/;

export function required(label: string, value: string): Refusal {
  return value.trim() === "" ? `${label} is required.` : null;
}

/** A whole number from `min` to `max` (a channel's number, 1 to 9999). */
export function wholeNumber(label: string, value: string, min = NUMBER_MIN, max = NUMBER_MAX): Refusal {
  const text = value.trim();
  if (text === "") return null;
  const number = WHOLE.test(text) ? Number(text) : Number.NaN;
  return number >= min && number <= max ? null : `${label} must be a whole number from ${min} to ${max}.`;
}

/** An address the browser parses and whose scheme is https. */
export function httpsAddress(label: string, value: string): Refusal {
  const text = value.trim();
  if (text === "") return null;
  try {
    return new URL(text).protocol === "https:" ? null : `${label} must be an https address.`;
  } catch {
    return `${label} must be an https address.`;
  }
}

/** A job's interval: a whole number and `m` or `h` (`30m`, `6h`, `24h`), or `off`. */
export function schedule(label: string, value: string): Refusal {
  const text = value.trim().toLowerCase();
  if (text === "" || text === "off" || SCHEDULE.test(text)) return null;
  return `${label} is a number and m or h, like 30m or 6h, or off.`;
}

export function year(label: string, value: string): Refusal {
  return wholeNumber(label, value, YEAR_MIN, YEAR_MAX);
}

/** A rating from 0 to 10, with decimals. */
export function rating(label: string, value: string): Refusal {
  const text = value.trim();
  if (text === "") return null;
  const number = DECIMAL.test(text) ? Number(text) : Number.NaN;
  return number >= 0 && number <= RATING_MAX ? null : `${label} must be from 0 to ${RATING_MAX}.`;
}

/** The first refusal of a list, in order, or null: a form reports one at a time. */
export function firstRefusal(refusals: readonly Refusal[]): Refusal {
  return refusals.find((refusal) => refusal !== null) ?? null;
}
