import { ERROR_SENTENCES } from "@/constants/api-sentences";
import { REFUSAL_SENTENCES } from "@/constants/sign-in-copy";

/* The password reset's words (`40` section 4.1). Copy lives here, never in a component, so a sentence reads the same
 * wherever it shows. */

/** The rows' labels, so the reset views fix their label column once. */
export const RESET_LABELS: readonly string[] = ["Username", "Question", "Answer", "New password"];

export const FORGOT_LINK = "Forgot password?";
export const RESET_HEADING = "Reset your password";
export const RESET_CONTINUE = "Continue";
export const RESET_SUBMIT = "Reset password";
export const RESET_SUBMITTING = "Resetting";
export const RESET_BACK = "Back to sign in";

/** Why a verb is disabled, in priority order. */
export const RESET_USERNAME_REASON = "Enter your username.";
export const RESET_ANSWER_REASON = "Enter your answer.";
export const RESET_PASSWORD_REASON = "Enter a new password.";
export const RESET_WAITING_REASON = "Waiting for the answer.";

/** The tip on the Question row of every answer view, the same for every username (a different one would say which
 *  usernames are accounts). The backend shows a stand-in question to an account that has none. */
export const NO_QUESTION_REASON =
  "If no security question was ever set for this account, it cannot be reset here: a signed-in admin must set one " +
  "first, in the Accounts workspace.";

export const ANSWER_TIP = "Answers are not case sensitive; extra spaces do not count.";

/** The refusals. `auth.reset_invalid` is the backend's own sentence, word for word. */
export const RESET_INVALID = ERROR_SENTENCES["auth.reset_invalid"] ?? "";
export const RESET_WEAK = "That password is not valid.";
export const RESET_PASSWORD_LONG = "Password must be at most 256 characters.";
export const RESET_UNREACHABLE = REFUSAL_SENTENCES.unreachable;
export const RESET_FAILED_TITLE = "Reset not done";

/** After a reset the gate shows the sign-in view with this on its notice. */
export const RESET_DONE_TITLE = "Password reset";
export const RESET_DONE_NOTICE = "Password reset. Sign in.";

export const USERNAME_LIMIT = 254;
export const PASSWORD_LIMIT = 256;
export const ANSWER_LIMIT = 200;
