import { randomUUID } from "node:crypto";

import type { AppErrorCode, ErrorEnvelope, SuccessEnvelope } from "../types/envelope.js";

/** Pure reply builders for the standard envelopes (`02` §2.1, §2.2). */
export function okEnvelope<T>(data: T): SuccessEnvelope<T> {
  return { ok: true, data };
}

export function errorEnvelope(
  code: AppErrorCode,
  message: string,
  extra: { details?: Record<string, unknown>; correlationId?: string } = {},
): ErrorEnvelope {
  const error: ErrorEnvelope["error"] = { code, message };
  if (extra.details !== undefined) error.details = extra.details;
  if (extra.correlationId !== undefined) error.correlationId = extra.correlationId;
  return { ok: false, error };
}

/** Opaque id tying an unexpected failure's log line to the reply the client saw. */
export function newCorrelationId(): string {
  return randomUUID();
}
