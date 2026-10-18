/** What a refusal can say beyond its code: the form field it is about and the server's correlation id. */
export interface ApiErrorExtras {
  readonly field?: string;
  readonly correlationId?: string;
}

/** A refusal or a failed request: a dotted code, a sentence fit for a status line, and the HTTP
 *  status when there was one. A refusal about one form field names it. */
export class ApiError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly field?: string;
  readonly correlationId?: string;

  constructor(code: string, message: string, status?: number, extras: ApiErrorExtras = {}) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.field = extras.field;
    this.correlationId = extras.correlationId;
  }
}
