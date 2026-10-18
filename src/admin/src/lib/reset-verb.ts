import {
  PASSWORD_LIMIT,
  RESET_ANSWER_REASON,
  RESET_PASSWORD_LONG,
  RESET_PASSWORD_REASON,
  RESET_USERNAME_REASON,
  RESET_WAITING_REASON,
} from "@/constants/reset-copy";

/* Why each reset verb is disabled, in priority order, or undefined when it can be used (`40` section 4.1). Pure: the verb
 * says why, a tooltip on a natively disabled button. The answer and the username are trimmed for the check; the password
 * never is (a space is part of it). */

/** `Continue`: waiting wins, then the missing username. */
export function continueReason(username: string, busy: boolean): string | undefined {
  if (busy) return RESET_WAITING_REASON;
  return username.trim() === "" ? RESET_USERNAME_REASON : undefined;
}

/** `Reset password`: waiting wins, then the answer, then the new password. */
export function resetReason(answer: string, newPassword: string, busy: boolean): string | undefined {
  if (busy) return RESET_WAITING_REASON;
  if (answer.trim() === "") return RESET_ANSWER_REASON;
  return newPassword === "" ? RESET_PASSWORD_REASON : undefined;
}

/** The page's own check of the new password, before anything is sent; the backend's `422` comes second. */
export function newPasswordRefusal(newPassword: string): string | null {
  return newPassword.length > PASSWORD_LIMIT ? RESET_PASSWORD_LONG : null;
}
