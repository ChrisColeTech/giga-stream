/**
 * What the admin window does with a navigation. THE WINDOW IS NOT A BROWSER: its page never leaves the origins it
 * may load, which are the backend's own and, unpackaged, the admin's Vite server. Anything else is refused, never
 * handed to the user's browser (the admin has no links out).
 */
export type NavigationVerdict = "allow" | "refuse";

/** The origin of an address, or null when it is not an address. */
export function originOf(target: string): string | null {
  try {
    return new URL(target).origin;
  } catch {
    return null;
  }
}

export function judgeNavigation(allowed: ReadonlySet<string>, target: string): NavigationVerdict {
  const origin = originOf(target);
  return origin !== null && allowed.has(origin) ? "allow" : "refuse";
}

/** Only the scheme and host of a refused address are reported; the rest is the page's choice. */
export function describeTarget(target: string): string {
  try {
    const url = new URL(target);
    return url.host ? `${url.protocol}//${url.host}` : url.protocol;
  } catch {
    return "an unreadable address";
  }
}
