import { z } from "zod";

/* `POST /api/auth/reset-start` answers `{ question }`; `POST /api/auth/reset` answers `{ reset: true }` (`40`
 * section 2.4). The per-account save route's answer lives in `account-schema.ts` (docs/54 section 2). */
export const ResetStartSchema = z.object({ question: z.string().min(1) });
export const ResetDoneSchema = z.object({ reset: z.literal(true) });
