import type { z } from "zod";

import { AppError, ERRORS, type ErrorDef } from "../constants/errors.ts";

/**
 * Step one of every route: validate an external value (`unknown`) against its schema. A failure names
 * the first offending field, never the offending value.
 */
export function parseInput<T>(
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  value: unknown,
  refusal: ErrorDef = ERRORS.requestInvalid,
): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const field = issue?.path.join(".") || "body";
  if (issue?.code === "unrecognized_keys") {
    throw new AppError(refusal, { field: issue.keys.join(",") }, `${issue.keys.join(", ")} is not a field that can be set.`);
  }
  const reason = issue?.code === "custom" ? ` It ${issue.message}.` : "";
  throw new AppError(refusal, { field }, `The ${field} is not valid.${reason}`);
}
