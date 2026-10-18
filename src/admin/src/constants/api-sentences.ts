import type { FailureCodes } from "@giga/http/request-types";
import type { SentenceTable } from "@giga/http/error-sentence";

/* The sentence for every error code the admin can meet (`29` section 7's table, word for word). Where the backend sends
 * its own plain sentence the request layer shows that one; this table is what a code shows otherwise, and what the
 * client-side codes show. */
export const FAILURE_CODES: FailureCodes = { invalid: "backend.bad_response", unreachable: "backend.unreachable" };

/** Raised by a service whose route is not wired yet: a visible refusal, never fake data. */
export const NOT_CONNECTED_CODE = "backend.not_connected";

export const ERROR_SENTENCES: SentenceTable = {
  "auth.unauthorized": "Sign in to do that.",
  "auth.invalid_credentials": "The email or password is wrong.",
  "auth.refresh_invalid": "That session has ended; sign in again.",
  "auth.rate_limited": "Too many sign-in attempts; wait a minute.",
  "auth.locked": "This account is locked for a while after failed sign-ins.",
  "account.not_found": "That account does not exist.",
  "account.invalid": "That account is not valid.",
  "account.email_taken": "Another account already uses that email.",
  "account.last_admin": "This is the last enabled account; another one is needed first.",
  "account_state.invalid": "Your saved settings are not valid.",
  "channel.not_found": "That channel does not exist.",
  "channel.invalid": "That channel is not valid.",
  "channel.taken": "Another channel already has that id or number.",
  "fault.invalid": "That fault is not valid.",
  "path.invalid": "That address is not valid.",
  "media.not_found": "That part of the stream is not available.",
  "range.unsatisfiable": "That byte range is outside the file.",
  "provider.not_found": "That provider does not exist.",
  "provider.invalid": "That provider is not valid.",
  "title.not_found": "That title does not exist.",
  "title.invalid": "That title is not valid.",
  "title.manual": "A title made by hand has no TMDB copy to go back to.",
  "tmdb.unavailable": "The title service cannot be reached right now.",
  "playlist.not_found": "That playlist does not exist.",
  "playlist.invalid": "That playlist is not valid.",
  "playlist.unreachable": "A playlist cannot be reached right now.",
  "playlist.busy": "A playlist sync is already running.",
  "playlist.unavailable": "The playlist is not available.",
  "job.not_found": "That job does not exist.",
  "job.invalid": "That job is not valid.",
  "job.disabled": "That job cannot run now.",
  "sync.busy": "That job is already running.",
  "sync.invalid": "That sync request is not valid.",
  "request.invalid": "The request was not understood.",
  "route.not_found": "There is nothing at that address.",
  "internal.failure": "Something went wrong on the server.",
  "store.newer_schema": "The backend's store is newer than this backend.",
  "store.migrate": "The backend's store could not be updated.",
  "store.failed": "The backend's store failed.",
  "backend.unreachable": "The admin backend cannot be reached.",
  "backend.bad_response": "The backend answered something this app cannot read.",
  [NOT_CONNECTED_CODE]: "This is not connected to the admin backend yet.",
};

/** A fresh sign-in is needed this long before an access token's expiry is the skew within which it is refreshed first. */
export const REFRESH_SKEW_MS = 30_000;
