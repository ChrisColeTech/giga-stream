import type { NewAccountDraft } from "./account-draft";

/** The create body: the email and name trimmed as the backend trims them, the password untouched (spaces are part of it). */
export function createBody(draft: NewAccountDraft): { email: string; name: string; password: string } {
  return { email: draft.email.trim(), name: draft.name.trim(), password: draft.password };
}

/** The body of a password change: only the password, never trimmed. */
export const passwordBody = (password: string): { password: string } => ({ password });
