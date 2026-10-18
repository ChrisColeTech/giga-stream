/**
 * Every stable error the admin backend answers (docs/03 section 8). Codes are dotted and domain-first;
 * the sentences are safe to show a person and never carry internals.
 */
export interface ErrorDef {
  readonly code: string;
  readonly status: number;
  readonly message: string;
}

export const ERRORS = {
  routeNotFound: { code: "route.not_found", status: 404, message: "There is nothing at that address." },
  requestInvalid: { code: "request.invalid", status: 400, message: "The request was not understood." },
  channelNotFound: { code: "channel.not_found", status: 404, message: "That channel does not exist." },
  channelInvalid: { code: "channel.invalid", status: 422, message: "That channel is not valid." },
  channelTaken: { code: "channel.taken", status: 409, message: "Another channel already has that id or number." },
  faultInvalid: { code: "fault.invalid", status: 400, message: "That fault is not valid." },
  mediaNotFound: { code: "media.not_found", status: 404, message: "That part of the stream is not available." },
  pathInvalid: { code: "path.invalid", status: 400, message: "That address is not valid." },
  playlistUnavailable: { code: "playlist.unavailable", status: 500, message: "The playlist is not available." },
  rangeUnsatisfiable: { code: "range.unsatisfiable", status: 416, message: "That byte range is outside the file." },
  playlistNotFound: { code: "playlist.not_found", status: 404, message: "That playlist does not exist." },
  jobNotFound: { code: "job.not_found", status: 404, message: "That job does not exist." },
  jobInvalid: { code: "job.invalid", status: 422, message: "That job is not valid." },
  jobDisabled: { code: "job.disabled", status: 422, message: "That job cannot run now." },
  titleInvalid: { code: "title.invalid", status: 422, message: "That title is not valid." },
  titleManual: { code: "title.manual", status: 409, message: "A title made by hand has no TMDB copy to go back to." },
  providerNotFound: { code: "provider.not_found", status: 404, message: "That provider does not exist." },
  providerInvalid: { code: "provider.invalid", status: 422, message: "That provider is not valid." },
  titleNotFound: { code: "title.not_found", status: 404, message: "That title does not exist." },
  tmdbUnavailable: { code: "tmdb.unavailable", status: 503, message: "The title service cannot be reached right now." },
  syncBusy: { code: "sync.busy", status: 409, message: "A catalog sync is already running." },
  syncInvalid: { code: "sync.invalid", status: 422, message: "That sync request is not valid." },
  playlistInvalid: { code: "playlist.invalid", status: 422, message: "That playlist is not an M3U playlist." },
  playlistTaken: {
    code: "playlist.taken",
    status: 409,
    message: "Another playlist already has that name, web address or file name.",
  },
  jobNotRunning: { code: "job.not_running", status: 409, message: "That job is not running." },
  jobNoLibraryFill: {
    code: "job.no_library_fill",
    status: 409,
    message: "There is no Library fill job to run; create a catalog job with the discover scope.",
  },
  jobEventsBusy: { code: "job.events_busy", status: 429, message: "Too many progress streams are open." },
  playlistUnreachable: { code: "playlist.unreachable", status: 503, message: "A playlist cannot be reached right now." },
  accountNotFound: { code: "account.not_found", status: 404, message: "That account does not exist." },
  accountInvalid: { code: "account.invalid", status: 422, message: "That account is not valid." },
  accountUsernameTaken: {
    code: "account.username_taken",
    status: 409,
    message: "Another account already uses that username.",
  },
  accountStateInvalid: { code: "account_state.invalid", status: 422, message: "That saved account state is not valid." },
  accountLastAdmin: {
    code: "account.last_admin",
    status: 409,
    message: "This is the last enabled account; another one is needed first.",
  },
  authUnauthorized: { code: "auth.unauthorized", status: 401, message: "Sign in to do that." },
  authInvalidCredentials: {
    code: "auth.invalid_credentials",
    status: 401,
    message: "The username or password is wrong.",
  },
  authRefreshInvalid: { code: "auth.refresh_invalid", status: 401, message: "That session has ended; sign in again." },
  authResetInvalid: {
    code: "auth.reset_invalid",
    status: 401,
    message: "That answer is not right, or the reset is not available for this username.",
  },
  storeNewerSchema: {
    code: "store.newer_schema",
    status: 500,
    message: "The database was written by a newer version of this program.",
  },
  storeMigrate: { code: "store.migrate", status: 500, message: "The database could not be upgraded." },
  storeFailed: { code: "store.failed", status: 500, message: "The database is not available." },
  internalFailure: { code: "internal.failure", status: 500, message: "Something went wrong on the server." },
} as const satisfies Record<string, ErrorDef>;

/** A refusal a service raises; the one error handler turns it into the envelope. */
export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Record<string, unknown> | undefined;

  constructor(def: ErrorDef, details?: Record<string, unknown>, message?: string) {
    super(message ?? def.message);
    this.name = "AppError";
    this.code = def.code;
    this.status = def.status;
    this.details = details;
  }
}
