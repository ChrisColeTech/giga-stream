/* The Accounts tab's words (`35` section 5.8): labels, tips, disabled reasons and notices. Copy lives here, never in a
 * component, so a refusal reads the same wherever it shows. */

/** The rows' labels, so each page fixes its label column once. Name first on every form (owner, 2026-10-17). */
export const NEW_ACCOUNT_LABELS: readonly string[] = ["Name", "Username", "Password"];
export const WORKSPACE_LABELS: readonly string[] = [
  "Name",
  "Username",
  "Enabled",
  "Last sign-in",
  "Security question",
  "New password",
];

export const ACCOUNT_SECTIONS = [
  { id: "ac-details", label: "Details" },
  { id: "ac-password", label: "Password" },
] as const;
export const ACCOUNT_SECTION_KEYS: readonly string[] = ACCOUNT_SECTIONS.map((section) => section.id);

export const ENABLED_TIP = "A disabled account cannot sign in.";
export const LAST_SIGN_IN_TIP = "When this account last signed in.";
export const SECURITY_QUESTION_TIP = "Each account sets its own, under Settings > Account.";
export const DELETE_TITLE = "Deletes the account and ends its sessions.";
export const SET_PASSWORD_TIP = "Signs this account out everywhere";

/** Disabled reasons. The unreachable sentence is the request layer's own. */
export const LAST_DISABLE = "The last enabled account cannot be disabled.";
export const UNREACHABLE_REASON = "The admin backend cannot be reached.";
export const SAVING_REASON = "Saving.";
export const LOADING_REASON = "Loading.";
export const TYPE_PASSWORD = "Type a new password.";

/** Value refusals (`35` section 5.9). */
export const USERNAME_LENGTH = "Username must be 1 to 254 characters.";
export const NAME_LENGTH = "Name must be 1 to 80 characters.";
export const PASSWORD_REQUIRED = "Password is required.";
export const PASSWORD_LONG = "Password must be at most 256 characters.";

/** Notices. A password is never part of one. */
export const accountCreated = (username: string): string => `Created ${username}.`;
export const accountSaved = (username: string): string => `Saved ${username}.`;
export const accountSavedSignedOut = (username: string): string => `Saved ${username}; it is signed out everywhere.`;
export const accountDeleted = (username: string): string => `Deleted ${username}.`;
export const passwordSet = (username: string): string => `Password set; ${username} is signed out everywhere.`;
export const unreadableAccounts = (count: number): string =>
  `${count} ${count === 1 ? "account" : "accounts"} could not be read.`;
export const OWN_DISABLED_NOTICE = "Your account was disabled.";
export const OWN_DELETED_NOTICE = "Your account was deleted.";
export const ACCOUNT_GONE = "That account no longer exists.";
export const NOT_SIGNED_IN_SENTENCE = "Sign in to do that.";
export const REQUEST_FAILED = "The request failed.";

/** The bulk verbs on the toolbar (`lib/account-bulk.ts`). */
export const BULK_ENABLE = "Enable";
export const BULK_DISABLE = "Disable";
export const BULK_DELETE = "Delete";
export const TICK_ACCOUNT_FIRST = "Tick an account first";
export const OWN_DISABLE_REFUSAL = "Your own account cannot be disabled here.";
export const OWN_DELETE_REFUSAL = "Your own account cannot be deleted here.";
export const ALREADY_ENABLED = "Already enabled.";
export const ALREADY_DISABLED = "Already disabled.";
