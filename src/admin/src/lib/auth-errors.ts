import { ApiError } from "@giga/http/api-error";
import { FAILURE_CODES, NOT_CONNECTED_CODE } from "@/constants/api-sentences";
import type { RefusalKind, ResetResult } from "@/types/auth";

/** The gate's refusal kind for a failed sign-in (`29` sections 6.1 and 7). A wrong pair, an unknown username and any other
 *  refusal the backend names are `invalid` (the backend answers one sentence for both); a lock and a rate limit have their
 *  own; an answer that never came, or came unreadable, or came as a server fault, is `unreachable`. Pure. */
export function refusalFor(error: unknown): RefusalKind {
  if (!(error instanceof ApiError)) return "unreachable";
  switch (error.code) {
    case "auth.locked":
      return "locked";
    case "auth.rate_limited":
      return "rate_limited";
    case FAILURE_CODES.unreachable:
    case FAILURE_CODES.invalid:
    case NOT_CONNECTED_CODE:
      return "unreachable";
    default:
      return error.status !== undefined && error.status >= 500 ? "unreachable" : "invalid";
  }
}

/** The reset views' refusal for a failed `reset-start` or `reset` (`40` section 4.3). `auth.reset_invalid` is `invalid`
 *  (the one sentence for a wrong answer, a lock and an unknown name); `account.invalid` is `weak` (the new password);
 *  a rate limit has its own; a transport failure, an unreadable answer or a server fault is `unreachable`. Pure. */
export function resetRefusalFor(error: unknown): Exclude<ResetResult, { ok: true }>["refusal"] {
  if (!(error instanceof ApiError)) return "unreachable";
  switch (error.code) {
    case "auth.reset_invalid":
      return "invalid";
    case "account.invalid":
      return "weak";
    case "auth.rate_limited":
      return "rate_limited";
    default:
      return "unreachable";
  }
}
