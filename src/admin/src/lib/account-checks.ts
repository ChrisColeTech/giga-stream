import { PASSWORD_MAX, PASSWORD_MIN, USERNAME_MAX } from "@/constants/account-limits";
import {
  PASSWORD_LONG,
  PASSWORD_REQUIRED,
  SAVING_REASON,
  UNREACHABLE_REASON,
  USERNAME_LENGTH,
} from "@/constants/account-copy";
import type { NewAccountDraft } from "./account-draft";
import { required, type Refusal } from "./field-checks";

/* The account rules (`35` section 5.9), mirroring the backend's (`03` section 7.11) so a form refuses before it sends.
 * They use the frozen primitives of `field-checks.ts`; an empty value passes every rule except `required`. */

/** A username is any text: trimmed it is 1 to 254 characters, and no format is checked. */
export function usernameLength(value: string): Refusal {
  const length = value.trim().length;
  return length === 0 || length <= USERNAME_MAX ? null : USERNAME_LENGTH;
}

/** Never trimmed: a space is part of a password. */
export function passwordLength(value: string): Refusal {
  return value.length > PASSWORD_MAX ? PASSWORD_LONG : null;
}

export interface FieldRefusal {
  readonly field: "username" | "password";
  readonly sentence: string;
}

const passwordRequired = (value: string): Refusal => (value.length < PASSWORD_MIN ? PASSWORD_REQUIRED : null);

/** Why `Create` is disabled, in the form's order, or undefined. Busy and unreachable come after the required fields. */
export function createReason(draft: NewAccountDraft, busy: boolean, unreachable: boolean): string | undefined {
  return (
    required("Username", draft.username) ??
    passwordRequired(draft.password) ??
    (busy ? SAVING_REASON : unreachable ? UNREACHABLE_REASON : undefined)
  );
}

/** The first value the form refuses when `Create` is pressed, in the form's order, or null. */
export function firstCreateRefusal(draft: NewAccountDraft): FieldRefusal | null {
  const checks: Array<[FieldRefusal["field"], Refusal]> = [
    ["username", usernameLength(draft.username)],
    ["password", passwordLength(draft.password)],
  ];
  const found = checks.find(([, sentence]) => sentence !== null);
  return found === undefined || found[1] === null ? null : { field: found[0], sentence: found[1] };
}

/** The refusal of a workspace save, for the fields that are being changed. */
export function firstSaveRefusal(patch: { username?: string }): FieldRefusal | null {
  const username =
    patch.username === undefined ? null : (required("Username", patch.username) ?? usernameLength(patch.username));
  return username === null ? null : { field: "username", sentence: username };
}

/** Why `Set new password` is disabled, or undefined once the value is valid. */
export function setPasswordReason(value: string, busy: boolean, unreachable: boolean, empty: string): string | undefined {
  if (value === "") return empty;
  return passwordLength(value) ?? (busy ? SAVING_REASON : unreachable ? UNREACHABLE_REASON : undefined) ?? undefined;
}
