/**
 * What the window does with a navigation (docs/14 section 2.2; the pattern of Giga Images'
 * lib/shell-navigation.ts). THE WINDOW IS NOT A BROWSER: the main frame never leaves the origin it was
 * loaded from. Unlike Giga Images, an off-origin target is NOT handed to the user's browser: in the
 * proof of concept the off-origin navigations and popups come from providers' players and their ads, so
 * they are refused and reported, never opened.
 */
export type NavigationVerdict = "allow" | "refuse";

export function judgeMainFrame(appOrigin: string, target: string): NavigationVerdict {
  try {
    return new URL(target).origin === appOrigin ? "allow" : "refuse";
  } catch {
    return "refuse";
  }
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
