import type { AdminAccount } from "@/types/admin-account";

/* The Accounts forms' values (`35` sections 5.4 and 5.8), pure. A draft is compared with the saved account's draft, so
 * `dirty` is a fact about values and never a flag set by typing. The username is the identity and comes first on every
 * form; an account has no name (owner, 2026-10-17). */

/** The New account form: all strings, as the fields hold them. */
export interface NewAccountDraft {
  readonly username: string;
  readonly password: string;
}

export const EMPTY_NEW_ACCOUNT: NewAccountDraft = { username: "", password: "" };

export const sameNewAccount = (a: NewAccountDraft, b: NewAccountDraft): boolean =>
  a.username === b.username && a.password === b.password;

/** The workspace's Details: `enabled` is the inverse of the stored `disabled`. */
export interface AccountDraft {
  readonly username: string;
  readonly enabled: boolean;
}

export const draftOf = (account: AdminAccount): AccountDraft => ({
  username: account.username,
  enabled: !account.disabled,
});

export const sameAccountDraft = (a: AccountDraft, b: AccountDraft): boolean =>
  a.username === b.username && a.enabled === b.enabled;

/** The fields of a PATCH: only what differs from the saved account, with the values trimmed as the backend trims them. */
export type AccountPatch = {
  readonly username?: string;
  readonly disabled?: boolean;
};

export function changedFields(saved: AdminAccount, draft: AccountDraft): AccountPatch {
  const username = draft.username.trim();
  return {
    ...(username !== saved.username && { username }),
    ...(draft.enabled === saved.disabled && { disabled: !draft.enabled }),
  };
}

export const isEmptyPatch = (patch: AccountPatch): boolean => Object.keys(patch).length === 0;
