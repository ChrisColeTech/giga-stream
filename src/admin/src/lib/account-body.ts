import type { AccountKind } from "@/types/admin-account";
import type { NewAccountDraft } from "./account-draft";

/** The create body (`62` section 3.7): the username trimmed as the backend trims it, the password untouched (spaces are
 *  part of it), and the kind ALWAYS sent — the backend takes it optionally, and an unconditional field has no branch to
 *  drift from the form. `admin` is what absence meant on the old answers anyway. */
export function createBody(draft: NewAccountDraft): { username: string; password: string; kind: AccountKind } {
  return { username: draft.username.trim(), password: draft.password, kind: draft.kind };
}

/** The body of a password change: only the password, never trimmed. */
export const passwordBody = (password: string): { password: string } => ({ password });
