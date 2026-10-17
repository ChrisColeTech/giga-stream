/** A refusal or a failed request: a dotted code, a sentence fit for a status line, and the HTTP
 *  status when there was one. */
export class ApiError extends Error {
  readonly code: string;
  readonly status?: number;

  constructor(code: string, message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}
