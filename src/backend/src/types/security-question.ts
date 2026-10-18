import { z } from "zod";

import { PASSWORD_MAX, USERNAME_MAX } from "../constants/limits.js";
import { SECURITY_ANSWER_MAX, SECURITY_QUESTION_COUNT } from "../constants/security-questions.js";
import { PasswordChangeSchema } from "./account.js";

/**
 * The bodies of the security-question routes (docs/40 sections 2.3, 2.4 and 3.2). The answer is limited before
 * normalisation; the new password is the same schema as a password change, so its limits stay in one place.
 */
const answer = z.string().max(SECURITY_ANSWER_MAX);
const newPassword = PasswordChangeSchema.shape.newPassword;

export const SecurityQuestionSetSchema = z
  .object({
    currentPassword: z.string().max(PASSWORD_MAX),
    question: z.number().int().min(1).max(SECURITY_QUESTION_COUNT),
    answer: answer.min(1),
  })
  .strict();

export const ResetStartSchema = z.object({ username: z.string().max(USERNAME_MAX) }).strict();

export const ResetSchema = z.object({ username: z.string().max(USERNAME_MAX), answer, newPassword }).strict();
