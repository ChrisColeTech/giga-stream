/* The form's units against the wire's (`37` section 4.3), pure: Runtime is minutes in the form and `runtimeMs` on the
 * wire; Genres and Cast are comma lists in the form and `string[]` on the wire. */

const MINUTE_MS = 60_000;

/** `runtimeMs` as the form's minutes ("" when absent). */
export const minutesOf = (runtimeMs: number | undefined): string =>
  runtimeMs === undefined ? "" : String(Math.round(runtimeMs / MINUTE_MS));

/** The form's minutes as `runtimeMs`; "" is absent, anything not a whole number is NaN (the checks refuse it first). */
export function runtimeMsOf(minutes: string): number | undefined {
  const text = minutes.trim();
  if (text === "") return undefined;
  return /^\d+$/.test(text) ? Number(text) * MINUTE_MS : Number.NaN;
}

/** A comma list as its items: trimmed, empties dropped, a repeat kept once. */
export function commaItems(text: string): string[] {
  const items = text.split(",").map((item) => item.trim()).filter((item) => item !== "");
  return [...new Set(items)];
}

export const commaText = (items: readonly string[] | undefined): string => (items ?? []).join(", ");

/** A number field's text as its value; "" is absent. */
export function numberOf(text: string): number | undefined {
  const value = text.trim();
  return value === "" ? undefined : Number(value);
}

export const textOf = (value: number | undefined): string => (value === undefined ? "" : String(value));
