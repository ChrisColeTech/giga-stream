import { z } from "zod";

/* `AdminAccount` and the account list (`29` section 5; `62` section 3.7). Non-strict: a field the backend adds later is
 * ignored. `kind` (`62` D1) is OPTIONAL and ABSENT on old answers, and absence means admin: an answer the backend has
 * not grown the column for yet still reads. A kind the schema does not know makes the WHOLE row unreadable — the list
 * drops it and counts it (`unreadable`), never silently relabels it. */
export const AccountSchema = z.object({
  id: z.union([z.string(), z.number()]),
  username: z.string(),
  disabled: z.boolean(),
  createdAt: z.number(),
  updatedAt: z.number(),
  lastSignInAt: z.number().optional(),
  /** Whether the account has set a security question (read only; never the question itself). */
  securityQuestionSet: z.boolean().optional(),
  /** What the account is for: the console (`admin`) or the app (`user`). Absent on old answers = `admin`. */
  kind: z.enum(["admin", "user"]).optional(),
});

export const AccountListSchema = z.object({ items: z.array(AccountSchema) });

/** `PUT /api/admin/accounts/:id/security-question` answers `{ set: true }` (docs/54 section 2): never the account, and
 *  never the question or its answer. */
export const QuestionSavedSchema = z.object({ set: z.literal(true) });

/** The list as the service reads it: rows stay `unknown` so one unreadable row costs that row, not the list
 *  (`01` section 8). `services/accounts.ts` parses each with `AccountSchema`. */
export const AccountListLenientSchema = z.object({ items: z.array(z.unknown()) });

export type AdminAccount = z.infer<typeof AccountSchema>;

/** The readable accounts and how many rows could not be read. */
export interface AccountList {
  readonly items: AdminAccount[];
  readonly unreadable: number;
}
