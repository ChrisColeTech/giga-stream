import { z } from "zod";
import { request } from "./api";
import {
  AccountListLenientSchema,
  AccountSchema,
  type AccountList,
  type AdminAccount,
} from "./schemas/account-schema";
import type { RecordService } from "./service-types";

/** The Accounts routes (`29` section 9.6), REAL: `GET`, `POST`, `PATCH` and `DELETE /api/admin-accounts`. A create takes
 *  `{ username, name, password }` (1 to 256 characters); a patch any of `username name password disabled`. `409
 *  account.username_taken` and `account.last_admin` arrive as `ApiError`s, a field-named refusal with its `field`. The list
 *  is read row by row: an unreadable row is dropped and counted (`unreadable`). A write answer that does not parse is
 *  `backend.bad_response`; the flows then re-read the list, since the write may have happened. */
export type AccountsService = RecordService<AdminAccount, string | number, AccountList>;

const DeletedSchema = z.object({ id: z.union([z.string(), z.number()]) });
const path = (id: string | number): string => `/api/admin-accounts/${encodeURIComponent(String(id))}`;

async function list(): Promise<AccountList> {
  const answer = await request("/api/admin-accounts", AccountListLenientSchema);
  const items: AdminAccount[] = [];
  for (const row of answer.items) {
    const parsed = AccountSchema.safeParse(row);
    if (parsed.success) items.push(parsed.data);
  }
  return { items, unreadable: answer.items.length - items.length };
}

export const accounts: AccountsService = {
  list,
  create: (input) => request("/api/admin-accounts", AccountSchema, { method: "POST", body: input }),
  update: (id, patch) => request(path(id), AccountSchema, { method: "PATCH", body: patch }),
  remove: (id) => request(path(id), DeletedSchema, { method: "DELETE" }),
};
