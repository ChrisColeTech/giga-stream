import type { RefusalKind } from "@/types/auth";

/* The gate's and the session's words (`62` section 3.5): the console's sentence set, re-worded for the app. Copy lives
 * here, never in a component, so a sentence reads the same wherever it shows. */

/** The rows' labels, so the gate fixes its label column once. */
export const SIGN_IN_LABELS: readonly string[] = ["Username", "Password"];

/** Why `Sign in` is disabled, in priority order (`lib/sign-in-verb.ts`). */
export const SIGN_IN_REASON = "Enter your username and password.";
export const SIGN_IN_USERNAME_REASON = "Enter your username.";
export const SIGN_IN_PASSWORD_REASON = "Enter your password.";
export const SIGN_IN_WAITING_REASON = "Waiting for the answer.";

export const SIGNED_IN_NOTICE = "Signed in.";
export const SIGNED_OUT_NOTICE = "Signed out.";

/** What the gate says after a session ends under the app (a 401 the refresh cookie could not answer). */
export const SESSION_ENDED_NOTICE = "Your session ended. Sign in again.";

export const REFUSAL_SENTENCES: Readonly<Record<RefusalKind, string>> = {
  invalid: "The username or password is wrong.",
  unreachable: "The account backend cannot be reached.",
};

export const GATE_HEADING = "Sign in";
export const GATE_NOTICE_TITLE = "Signed out";
export const SIGNING_IN_LABEL = "Signing in";

/** The brand column's headline (`34` section 2's pattern, the app's words). */
export const GATE_BRAND_HEADLINE = "Watch everything.";

/** The desktop's escape (`62` section 3.5): enter the app signed out, today's local-only behaviour. */
export const OFFLINE_LABEL = "Continue offline";
export const OFFLINE_TIP = "Use the app without an account; changes stay on this computer only.";

/** The one-time merge of `62` D8, said in the events drawer when the account's settings replaced the device's. */
export const ACCOUNT_SETTINGS_NOTICE = "Signed in: the account's settings replaced the ones saved on this device.";
/** A settings change saved to the account but not mirrored into this browser's offline cache. */
export const SETTINGS_CACHE_NOTICE = "The account's settings could not be cached in this browser.";
