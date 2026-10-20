import { z } from "zod";
import { request } from "./api";
import {
  AccountListLenientSchema,
  AccountSchema,
  QuestionSavedSchema,
  type AccountList,
  type AdminAccount,
} from "./schemas/account-schema";
import type { RecordService } from "./service-types";

/** The Accounts routes (`29` section 9.6; `62` section 3.7), REAL: `GET`, `POST`, `PATCH` and `DELETE
 *  /api/admin/accounts`, and `PUT /api/admin/accounts/:id/security-question` (docs/54 section 2). A create takes
 *  `{ username, password, kind }` (1 to 256 characters; the kind optional on the wire and always sent); a patch any of
 *  `username name password disabled`; the question save takes `{ question, answer }` and answers `{ set: true }`.
 *  `409 account.username_taken` and `account.last_admin` arrive as `ApiError`s, a field-named refusal with its `field`.
 *  The list is read row by row: an unreadable row is dropped and counted (`unreadable`) — a nonsense `kind` makes its
 *  row unreadable, so nothing invented is ever shown. A write answer that does not parse is `backend.bad_response`; the
 *  flows then re-read the list, since the write may have happened. */
export type AccountsService = RecordService<AdminAccount, string | number, AccountList> & {
  /** Sets or replaces a selected account's question. The answer carries nothing of it back but `{ set: true }`. */
  readonly saveQuestion: (
    id: string | number,
    body: { readonly question: number; readonly answer: string },
  ) => Promise<{ readonly set: true }>;
};

const DeletedSchema = z.object({ id: z.union([z.string(), z.number()]) });
const path = (id: string | number): string => `/api/admin/accounts/${encodeURIComponent(String(id))}`;

async function list(): Promise<AccountList> {
  const answer = await request("/api/admin/accounts", AccountListLenientSchema);
  const items: AdminAccount[] = [];
  for (const row of answer.items) {
    const parsed = AccountSchema.safeParse(row);
    if (parsed.success) items.push(parsed.data);
  }
  return { items, unreadable: answer.items.length - items.length };
}

export const accounts: AccountsService = {
  list,
  create: (input) => request("/api/admin/accounts", AccountSchema, { method: "POST", body: input }),
  update: (id, patch) => request(path(id), AccountSchema, { method: "PATCH", body: patch }),
  remove: (id) => request(path(id), DeletedSchema, { method: "DELETE" }),
  saveQuestion: (id, body) => request(`${path(id)}/security-question`, QuestionSavedSchema, { method: "PUT", body }),
};
