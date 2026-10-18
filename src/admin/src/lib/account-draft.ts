import type { AdminAccount } from "@/types/admin-account";

/* The Accounts forms' values (`35` sections 5.4 and 5.8), pure. A draft is compared with the saved account's draft, so
 * `dirty` is a fact about values and never a flag set by typing. Name comes first on every form (owner, 2026-10-17). */

/** The New account form: all strings, as the fields hold them. */
export interface NewAccountDraft {
  readonly name: string;
  readonly email: string;
  readonly password: string;
}

export const EMPTY_NEW_ACCOUNT: NewAccountDraft = { name: "", email: "", password: "" };

export const sameNewAccount = (a: NewAccountDraft, b: NewAccountDraft): boolean =>
  a.name === b.name && a.email === b.email && a.password === b.password;

/** The workspace's Details: `enabled` is the inverse of the stored `disabled`. */
export interface AccountDraft {
  readonly name: string;
  readonly email: string;
  readonly enabled: boolean;
}

export const draftOf = (account: AdminAccount): AccountDraft => ({
  name: account.name,
  email: account.email,
  enabled: !account.disabled,
});

export const sameAccountDraft = (a: AccountDraft, b: AccountDraft): boolean =>
  a.name === b.name && a.email === b.email && a.enabled === b.enabled;

/** The fields of a PATCH: only what differs from the saved account, with the values trimmed as the backend trims them. */
export type AccountPatch = {
  readonly name?: string;
  readonly email?: string;
  readonly disabled?: boolean;
};

export function changedFields(saved: AdminAccount, draft: AccountDraft): AccountPatch {
  const name = draft.name.trim();
  const email = draft.email.trim();
  return {
    ...(name !== saved.name && { name }),
    ...(email !== saved.email && { email }),
    ...(draft.enabled === saved.disabled && { disabled: !draft.enabled }),
  };
}

export const isEmptyPatch = (patch: AccountPatch): boolean => Object.keys(patch).length === 0;
