import { z } from "zod";

/** The password reset's answers (`40` section 2.4): `POST /api/admin/auth-security/reset-start` answers
 *  `{ question }` (the account's own, or the stand-in - the backend never says which), and `reset` answers
 *  `{ reset: true }`. The routes live under the console's auth-security prefix, where the backend mounts the
 *  reset for both kinds (`62` D2). */
export const ResetStartSchema = z.object({ question: z.string().min(1) });
export const ResetDoneSchema = z.object({ reset: z.literal(true) });
