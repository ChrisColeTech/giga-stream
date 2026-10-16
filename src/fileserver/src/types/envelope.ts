/**
 * The standard success and error envelopes (`03` section 2) and the fileserver's stable dotted error
 * codes (`03` section 8). Every REST reply is one of these two shapes; no route invents another.
 */

export interface SuccessEnvelope<T> {
  ok: true;
  data: T;
}

export interface ErrorBody {
  code: AppErrorCode;
  /** A plain sentence safe to show directly in the UI. */
  message: string;
  /** Optional structured data; never a stack trace and never a local path. */
  details?: Record<string, unknown>;
  /** Present for unexpected failures; the matching log line carries the real exception. */
  correlationId?: string;
}

export interface ErrorEnvelope {
  ok: false;
  error: ErrorBody;
}

export type Envelope<T> = SuccessEnvelope<T> | ErrorEnvelope;

export type AppErrorCode =
  | "route.not_found"
  | "request.invalid"
  | "settings.invalid"
  | "backend.invalid_url"
  | "backend.tls_required"
  | "backend.unreachable"
  | "backend.bad_response"
  | "channel.not_found"
  | "fs.desktop_required"
  | "fs.cancelled"
  | "fs.invalid_selection"
  | "job.not_found"
  | "job.not_running"
  | "job.not_settled"
  | "collection.not_found"
  | "media.not_found"
  | "playback.range_invalid"
  | "store.open"
  | "store.newer_schema"
  | "store.migrate"
  | "store.failed"
  | "internal.failure";
