import { ApiError } from "@giga/http/api-error";
import type { ProfileResult, RefusalKind, RegistrationResult, ResetResult } from "@/types/auth";

/* The gate's refusal kinds (`62` section 3.5): the console's `lib/auth-errors.ts`, reading the app's failure codes.
 * An unreachable account backend is a truthful refusal, never a fake answer. */

/** The gate's refusal kind for a failed sign-in. A wrong pair, an unknown username and any other refusal the backend
 *  names are `invalid` (the backend answers one sentence for both); an answer that never came, or came unreadable,
 *  or came as a server fault, is `unreachable`. Pure. */
export function refusalFor(error: unknown): RefusalKind {
  if (!(error instanceof ApiError)) return "unreachable";
  switch (error.code) {
    case "response.invalid":
    case "fileserver.unreachable":
      return "unreachable";
    default:
      return error.status !== undefined && error.status >= 500 ? "unreachable" : "invalid";
  }
}

/** The reset views' refusal for a failed `reset-start` or `reset`. `auth.reset_invalid` is `invalid` (the one
 *  sentence for a wrong answer and an unknown name); `account.invalid` is `weak` (the new password); a transport
 *  failure, an unreadable answer or a server fault is `unreachable`. Pure. */
export function resetRefusalFor(error: unknown): Exclude<ResetResult, { ok: true }>["refusal"] {
  if (!(error instanceof ApiError)) return "unreachable";
  switch (error.code) {
    case "auth.reset_invalid":
      return "invalid";
    case "account.invalid":
      return "weak";
    default:
      return "unreachable";
  }
}

export function registrationRefusalFor(
  error: unknown,
): Exclude<RegistrationResult, { ok: true }>["refusal"] {
  if (!(error instanceof ApiError)) return "unreachable";
  if (error.code === "account.username_taken") return "usernameTaken";
  if (error.code === "account.invalid" || (error.status !== undefined && error.status < 500)) return "invalid";
  return "unreachable";
}

export function profileRefusalFor(error: unknown): Exclude<ProfileResult, { ok: true }>["refusal"] {
  if (!(error instanceof ApiError)) return "unreachable";
  if (error.code === "account.username_taken") return "usernameTaken";
  if (error.code === "account.invalid") return "invalid";
  return "unreachable";
}
