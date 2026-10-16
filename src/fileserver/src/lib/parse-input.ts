import type { z } from "zod";

import type { AppErrorCode } from "../types/envelope.js";
import { AppError } from "./app-error.js";

export interface InputRefusal {
  code: AppErrorCode;
  status: number;
}

const MALFORMED: InputRefusal = { code: "request.invalid", status: 400 };

/**
 * Validate one external value (body, params, query) against a Zod schema. A failure becomes an
 * `AppError` whose message is the first issue, so routes never see a `ZodError`.
 */
export function parseInput<S extends z.ZodTypeAny>(
  schema: S,
  value: unknown,
  refusal: InputRefusal = MALFORMED,
): z.infer<S> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const where = issue && issue.path.length > 0 ? ` (${issue.path.join(".")})` : "";
  const message = issue?.message ?? "That request was not understood.";
  throw new AppError(refusal.code, refusal.status, `${message}${where}`.slice(0, 300));
}
