import {
  SIGN_IN_PASSWORD_REASON,
  SIGN_IN_REASON,
  SIGN_IN_USERNAME_REASON,
  SIGN_IN_WAITING_REASON,
} from "@/constants/gate-copy";
import type { GateState } from "@/lib/gate-state";

/** Why `Sign in` cannot be used, or undefined when it can (the button says why). Submitting wins, then both fields
 *  empty, then the one missing. The username is trimmed for the check; the password never is. An unreachable gate
 *  leaves the verb enabled: pressing it is the retry. */
export function signInReason(username: string, password: string, gate: GateState): string | undefined {
  if (gate.phase === "submitting") return SIGN_IN_WAITING_REASON;
  const noUsername = username.trim() === "";
  const noPassword = password === "";
  if (noUsername && noPassword) return SIGN_IN_REASON;
  if (noUsername) return SIGN_IN_USERNAME_REASON;
  if (noPassword) return SIGN_IN_PASSWORD_REASON;
  return undefined;
}
