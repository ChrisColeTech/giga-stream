/* The Accounts tab's words (`35` section 5.8): labels, tips, disabled reasons and notices. Copy lives here, never in a
 * component, so a refusal reads the same wherever it shows. */

/** The rows' labels, so each page fixes its label column once. The identity first on every form: the username
 *  (an account has no name, owner, 2026-10-17). */
export const NEW_ACCOUNT_LABELS: readonly string[] = ["Username", "Password"];
export const WORKSPACE_LABELS: readonly string[] = [
  "Username",
  "Enabled",
  "Last sign-in",
  "Security question",
  "Answer",
  "New password",
];

export const ACCOUNT_SECTIONS = [
  { id: "ac-details", label: "Details" },
  { id: "ac-password", label: "Password" },
  { id: "ac-question", label: "Security question" },
] as const;
export const ACCOUNT_SECTION_KEYS: readonly string[] = ACCOUNT_SECTIONS.map((section) => section.id);

export const USERNAME_TIP = "Any text, 1 to 254 characters. It is how the account signs in.";
export const PASSWORD_TIP = "Up to 256 characters. A space counts. It is never shown back.";
export const NEW_PASSWORD_TIP = "Up to 256 characters. Setting it signs the account out everywhere.";
export const ENABLED_TIP = "A disabled account cannot sign in.";
export const LAST_SIGN_IN_TIP = "When this account last signed in.";
export const DELETE_TITLE = "Deletes the account and ends its sessions.";
export const SET_PASSWORD_TIP = "Signs this account out everywhere";

/* The Security question group (docs/54 section 2): the words. A question is set on the selected account by the
 * signed-in admin; the group's badge carries the account's flag. */

export const QUESTION_STATUS_SET = "Set";
export const QUESTION_STATUS_NOT_SET = "Not set";
export const QUESTION_TIP = "Asked on the sign-in page when this account resets its password.";
export const ANSWER_TIP = "Used only to reset this account's password from the sign-in page.";
export const SAVE_QUESTION = "Save question";
export const SAVING_QUESTION = "Saving";
export const CHOOSE_QUESTION_REASON = "Choose a question.";
export const ENTER_ANSWER_REASON = "Enter your answer.";
export const ANSWER_TOO_LONG = "Answer must be at most 200 characters.";
export const ANSWER_NOT_VALID = "The answer is not valid.";

/** Disabled reasons. The unreachable sentence is the request layer's own. */
export const LAST_DISABLE = "The last enabled account cannot be disabled.";
export const UNREACHABLE_REASON = "The admin backend cannot be reached.";
export const SAVING_REASON = "Saving.";
export const LOADING_REASON = "Loading.";
export const TYPE_PASSWORD = "Type a new password.";

/** Value refusals (`35` section 5.9). */
export const USERNAME_LENGTH = "Username must be 1 to 254 characters.";
export const PASSWORD_REQUIRED = "Password is required.";
export const PASSWORD_LONG = "Password must be at most 256 characters.";

/** Notices. A password is never part of one. */
export const accountCreated = (username: string): string => `Created ${username}.`;
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
