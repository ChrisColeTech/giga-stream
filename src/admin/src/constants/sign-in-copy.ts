import type { RefusalKind } from "@/types/auth";

/* The gate's words (`34` section 3). The refusal sentences are `29` section 7's table, word for word. */

/** The rows' labels, so the page fixes its label column once. */
export const SIGN_IN_LABELS: readonly string[] = ["Username", "Password"];

/** Why `Sign in` is disabled, in priority order (`lib/sign-in-verb.ts`). */
export const SIGN_IN_REASON = "Enter your username and password.";
export const SIGN_IN_USERNAME_REASON = "Enter your username.";
export const SIGN_IN_PASSWORD_REASON = "Enter your password.";
export const SIGN_IN_WAITING_REASON = "Waiting for the answer.";

export const SIGNED_IN_NOTICE = "Signed in.";
export const SIGNED_OUT_NOTICE = "Signed out.";

/** What the gate says after a session ends under the app (a refresh that failed, a second 401): `29` section 6.2. */
export const SESSION_ENDED_NOTICE = "Your session ended. Sign in again.";

/** Changing your OWN password ends your sessions, this one included (`29` section 6.2). */
export const PASSWORD_CHANGED_NOTICE = "Password changed. Sign in again.";

export const REFUSAL_SENTENCES: Readonly<Record<RefusalKind, string>> = {
  invalid: "The username or password is wrong.",
  unreachable: "The admin backend cannot be reached.",
};

export const GATE_HEADING = "Sign in";
export const GATE_NOTICE_TITLE = "Signed out";
export const SIGNING_IN_LABEL = "Signing in";

/** The brand column (`34` section 2: the reference's lockup and headline). */
export const GATE_BRAND_HEADLINE = "Run the channels.";
