/** The host of an address, or null when it cannot be parsed: sentences may name a host and never a path, query or
 *  token (`21` section 9). */
export function hostOf(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}
