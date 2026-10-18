import { z } from "zod";
import { request } from "./api";
import { AccountListSchema, AccountSchema, type AccountList, type AdminAccount } from "./schemas/account-schema";
import type { RecordService } from "./service-types";

/** The Accounts routes (`29` section 9.6), REAL: `GET`, `POST`, `PATCH` and `DELETE /api/admin-accounts`. A create takes
 *  `{ email, name, password }` (12 to 256 characters); a patch any of `email name password disabled`. `409
 *  account.email_taken` and `account.last_admin` arrive as `ApiError`s. Changing your OWN password ends your sessions:
 *  the caller then calls the store's `endSession(PASSWORD_CHANGED_NOTICE)`. */
export type AccountsService = RecordService<AdminAccount, string | number, AccountList>;

const DeletedSchema = z.object({ id: z.union([z.string(), z.number()]) });
const path = (id: string | number): string => `/api/admin-accounts/${encodeURIComponent(String(id))}`;

export const accounts: AccountsService = {
  list: () => request("/api/admin-accounts", AccountListSchema),
  create: (input) => request("/api/admin-accounts", AccountSchema, { method: "POST", body: input }),
  update: (id, patch) => request(path(id), AccountSchema, { method: "PATCH", body: patch }),
  remove: (id) => request(path(id), DeletedSchema, { method: "DELETE" }),
};
