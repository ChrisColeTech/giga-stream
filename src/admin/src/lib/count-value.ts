/** The number a list cell shows as a grouped figure (`2,598`), for sorting the column by value. Not a number: 0. */
export function countValue(text: string): number {
  const value = Number(text.replaceAll(",", ""));
  return Number.isNaN(value) ? 0 : value;
}
