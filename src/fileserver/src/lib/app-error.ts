import type { AppErrorCode } from "../types/envelope.js";

/**
 * A refusal the caller may see: a dotted code, an HTTP status and a plain sentence (`03` section 2).
 * Thrown by services and repositories, mapped to the error envelope by the one Fastify error
 * handler. The message must be safe to show verbatim: no paths, no SQL, no stack.
 */
export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  /** `cause` is the underlying exception: logged, never sent to a client. */
  constructor(
    code: AppErrorCode,
    status: number,
    message: string,
    details?: Record<string, unknown>,
    cause?: unknown,
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "AppError";
    this.code = code;
    this.status = status;
    if (details !== undefined) this.details = details;
  }
}
