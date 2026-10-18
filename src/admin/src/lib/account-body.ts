import type { NewAccountDraft } from "./account-draft";

/** The create body: the username and name trimmed as the backend trims them, the password untouched (spaces are part of it). */
export function createBody(draft: NewAccountDraft): { username: string; name: string; password: string } {
  return { username: draft.username.trim(), name: draft.name.trim(), password: draft.password };
}

/** The body of a password change: only the password, never trimmed. */
export const passwordBody = (password: string): { password: string } => ({ password });
