import type { z } from "zod";

import { AppError, ERRORS, type ErrorDef } from "../constants/errors.js";

/**
 * Step one of every route: validate an external value (`unknown`) against its schema. A failure names
 * the first offending field, never the offending value. Path parameters and malformed requests are
 * `request.invalid`; a channel's fields are `channel.invalid` (docs/03 section 7.2).
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
  const sentence = issue?.code === "unrecognized_keys"
    ? `${issue.keys.join(", ")} is not a field that can be set.`
    : `The ${field} is not valid.`;
  throw new AppError(refusal, { field: issue?.code === "unrecognized_keys" ? issue.keys.join(",") : field }, sentence);
}
