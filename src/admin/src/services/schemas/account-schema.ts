import { z } from "zod";

/* `AdminAccount` and the account list (`29` section 5). Non-strict: a field the backend adds later is ignored. */
export const AccountSchema = z.object({
  id: z.union([z.string(), z.number()]),
  email: z.string(),
  name: z.string(),
  disabled: z.boolean(),
  createdAt: z.number(),
  updatedAt: z.number(),
  lastSignInAt: z.number().optional(),
});

export const AccountListSchema = z.object({ items: z.array(AccountSchema) });

/** The list as the service reads it: rows stay `unknown` so one unreadable row costs that row, not the list
 *  (`01` section 8). `services/accounts.ts` parses each with `AccountSchema`. */
export const AccountListLenientSchema = z.object({ items: z.array(z.unknown()) });

export type AdminAccount = z.infer<typeof AccountSchema>;

/** The readable accounts and how many rows could not be read. */
export interface AccountList {
  readonly items: AdminAccount[];
  readonly unreadable: number;
}
