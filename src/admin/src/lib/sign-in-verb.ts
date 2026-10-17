import {
  SIGN_IN_EMAIL_REASON,
  SIGN_IN_PASSWORD_REASON,
  SIGN_IN_REASON,
  SIGN_IN_WAITING_REASON,
} from "@/constants/sign-in-copy";
import type { GateState } from "./gate-state";

/** Why `Sign in` cannot be used, or undefined when it can (the template's model: the button says why). Submitting wins,
 *  then both fields empty, then the one missing. The email is trimmed for the check; the password never is. A locked or
 *  unreachable gate leaves the verb enabled: the server decides when a lock ends, and pressing it is the retry. */
export function signInReason(email: string, password: string, gate: GateState): string | undefined {
  if (gate.phase === "submitting") return SIGN_IN_WAITING_REASON;
  const noEmail = email.trim() === "";
  const noPassword = password === "";
  if (noEmail && noPassword) return SIGN_IN_REASON;
  if (noEmail) return SIGN_IN_EMAIL_REASON;
  if (noPassword) return SIGN_IN_PASSWORD_REASON;
  return undefined;
}
