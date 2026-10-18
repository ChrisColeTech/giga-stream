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

export type AdminAccount = z.infer<typeof AccountSchema>;
export type AccountList = z.infer<typeof AccountListSchema>;
