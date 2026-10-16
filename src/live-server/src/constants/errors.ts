/**
 * Every stable error the live server answers (docs/10 section 3.1). Codes are dotted and domain-first; the
 * sentences are safe to show a person and never carry internals.
 */
export interface ErrorDef {
  readonly code: string;
  readonly status: number;
  readonly message: string;
}

export const ERRORS = {
  routeNotFound: { code: "route.not_found", status: 404, message: "There is nothing at that address." },
  requestInvalid: { code: "request.invalid", status: 400, message: "The request was not understood." },
  loopbackOnly: { code: "access.loopback_only", status: 403, message: "Changes are accepted only on this computer." },
  channelNotFound: { code: "channel.not_found", status: 404, message: "That channel does not exist." },
  channelInvalid: { code: "channel.invalid", status: 422, message: "That channel is not valid." },
  channelTaken: { code: "channel.taken", status: 409, message: "Another channel already has that id or number." },
  faultInvalid: { code: "fault.invalid", status: 400, message: "That fault is not valid." },
  mediaNotFound: { code: "media.not_found", status: 404, message: "That part of the stream is not available." },
  pathInvalid: { code: "path.invalid", status: 400, message: "That address is not valid." },
  playlistUnavailable: { code: "playlist.unavailable", status: 500, message: "The playlist is not available." },
  rangeUnsatisfiable: { code: "range.unsatisfiable", status: 416, message: "That byte range is outside the file." },
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
