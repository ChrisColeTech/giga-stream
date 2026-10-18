import { z } from "zod";

/* `POST /api/auth/reset-start` answers `{ question }`; `POST /api/auth/reset` answers `{ reset: true }`;
 * `PUT /api/auth/me/security-question` answers `{ set: true }` (`40` sections 2.3 and 2.4). */
export const ResetStartSchema = z.object({ question: z.string().min(1) });
export const ResetDoneSchema = z.object({ reset: z.literal(true) });
export const QuestionSavedSchema = z.object({ set: z.literal(true) });
