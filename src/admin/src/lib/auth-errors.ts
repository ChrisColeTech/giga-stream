import { ApiError } from "@giga/http/api-error";
import { FAILURE_CODES, NOT_CONNECTED_CODE } from "@/constants/api-sentences";
import type { RefusalKind } from "@/types/auth";

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
