/* The fixture build's address switches, as the mockup has them, so the two apps can be put in the same state for a
 * comparison. Deleted by `29` (Wave 7), when the real session decides who is signed in. */

/** Whether the session starts signed in: `?signedin=0` starts on the sign-in page. */
export function signedInFrom(search: string): boolean {
  return new URLSearchParams(search).get("signedin") !== "0";
}

/** The switch as this page load reads it. A host with no address (a test) starts signed in. */
export const FIXTURE_SIGNED_IN: boolean = signedInFrom(typeof window === "undefined" ? "" : window.location.search);
