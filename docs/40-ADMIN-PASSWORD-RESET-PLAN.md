# 40 - Admin password reset by security question (Waves B3 and R)

> **Amended 2026-10-18 (owner):** the reset has no attempt limit and no lock (the five-wrong-answers 15-minute lock, the
> `reset_attempts` table and `429 auth.rate_limited` are removed).

> **Amended 2026-10-18 (`54`, owner):** the question is set **per account by a signed-in admin** in the Accounts workspace,
> not by each account for itself in Settings: `PUT /api/auth/me/security-question` and the Settings > Account page are gone,
> replaced by `PUT /api/admin-accounts/:accountId/security-question` and the workspace's `Security question` group. Sections
> 2.3, 2.6, 3.3, 4.1, 4.2 and 4.4 are amended accordingly.

**Status: built (backend B3, branch `backend/reset`; username rename and admin Wave R, branch `admin/username-reset`).** Owner, 2026-10-17: "add a password reset button to the login form", then "lets do security question instead of email for password reset", then "we don't have emails set up, why would it use email for login." There is no email, no SMTP, no reset code, no console sink, no Electron dialog and no tray action, and **the sign-in name is a plain username**: any text, trimmed, 1 to 254 characters, no format check, unique without case (migration `019`). The reset is answered by a **security question** that a signed-in admin sets for the account in the Accounts workspace (`54`; before it, each account set its own in Settings). The program is `39` (B3 took migration `018`, the rename `019`). Governed by `00`, `01`, `03` 7.11 and 7.12, `07`, `26` (D5, D22), `34`.

## 1. What exists (verified in source)

| Piece | Where |
|---|---|
| Accounts with a scrypt password hash (`hashPassword`, `verifyPassword`, a `decoyHash` for unknown usernames), `session_version`, `failed_sign_ins`, `locked_until` | `store/account-repository.ts`, `services/password.ts`, `services/auth-service.ts` |
| `revokeAll(accountId)`: bumps `session_version` and revokes every refresh token | `services/auth-service.ts` |
| The sign-in limiter (ten a minute per address, in memory) | `services/sign-in-limiter.ts` |
| The lockout on five wrong passwords (15 minutes), audited as `auth.login_failed` with the typed username | `services/auth-service.ts` |
| The audit log, `Actor`, `actorOf(request)`, `signedIn(services, request)` | `services/audit-service.ts`, `api/guard.ts` |
| `changePassword` (signed in, current password checked, `auth.invalid_credentials` with `details.field` on a wrong current password) | `services/auth-service.ts`, `api/auth.ts` |
| The reset: `services/security-question-service.ts`, `store/reset-attempts-repository.ts`, `api/auth-security.ts`, `constants/security-questions.ts` | `src/backend` |
| The admin gate: `SignInPage`, `SignInForm`, `GateNotice`, `lib/gate-state.ts`, `AuthPort`, `createAuthPort` | `src/admin/src/...` (`34`) |
| The reset views: `lib/reset-state.ts`, `ResetUsernameForm`, `ResetAnswerForm`, `ForgotLink`, `hooks/useResetStart.ts`, `hooks/useResetPassword.ts` | `src/admin/src/...` |
| Settings window pages: Appearance, Session, About (`54` removed the Account page) | `src/admin/src/constants/settings-sections.ts`, `components/settings/*` |

## 2. The design

**Each account sets one security question and its answer. A reset asks the question and, when the answer is right, sets a new password.** No message leaves the backend by any channel other than the HTTP answers the person asks for.

### 2.1 The question

- **A fixed picklist of eight questions**, held in `constants/security-questions.ts` and numbered 1 to 8 (`security_question` stores the number). Free text is refused: a custom question would look different from the decoy questions of 2.4, which would let an observer tell a real account from an unknown username. The owner may overrule (open decision 2). The admin mirrors the eight in `constants/security-questions.ts` (a test reads the backend's file and compares).
  1. What was the name of your first pet?
  2. In what city were you born?
  3. What was the name of your first school?
  4. What is your mother's maiden name?
  5. What was the make of your first car?
  6. What was the name of the street you grew up on?
  7. What was your childhood nickname?
  8. What is your favourite book?

### 2.2 The answer

- Stored only as a **scrypt hash** (`hashPassword`, salted), never in plain text.
- **Normalised before hashing and before every comparison:** `answer.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US")`. So `  Rex  ` and `rex` are the same answer, and `Golden   Retriever` and `golden retriever` are the same. An answer that is empty after normalisation is refused (`422 account.invalid`, field `answer`). The answer is at most 200 characters before normalisation.

### 2.3 Setting or changing the question (a signed-in admin, per account; amended by `54`)

- Route `PUT /api/admin-accounts/:accountId/security-question`, body `{ question, answer }` (strict). No current password: the actor is a signed-in admin, who already holds password power over every account (`54` decision 1).
- Any signed-in admin sets or changes **any** account's question, including their own (every account appears in the Accounts list). A question is never removed by a route (an account with no question stays without one until an admin sets one).
- A gone account answers `404 account.not_found`, the admin-accounts routes' standard refusal. Changing the question does **not** end sessions (it is not a credential change). Audit `account.security_question_set` (actor: the signed-in admin; subject: the account; detail `{ username }`; never the answer).
- Answer `200 { set: true }`.

### 2.4 Resetting: `reset-start` and `reset`

The enumeration rule: **an answer never differs by whether the username is an account, whether that account has a question, or whether it is disabled.** Every branch below produces the same shape and the same timing (a dummy `verifyPassword` runs on each branch that has no real hash to check, as `login` does with `decoyHash`).

**The decoy question.** For a username with no account, or an account with no question, the question shown is `SECURITY_QUESTIONS[n]`, where `n = HMAC-SHA256(JWT_SECRET, "reset-decoy:" + usernameKey)` taken as an unsigned integer modulo 8. `usernameKey` is the username trimmed and lower-cased (the backend's own `username_key`). It is stable: the same username always gets the same decoy question. A `JWT_SECRET` change changes the decoys (noted in 5).

**`POST /api/auth/reset-start`** (public; body `{ username }`, strict, at most 254 characters)

- Answer `200 { question: "<the question text>" }` for **every** username: the account's real question when it has one and is enabled; the decoy otherwise (unknown username, account with no question, disabled account). The disabled case uses the real question, which is shape-identical to a decoy, so nothing is revealed.
- Passes through the per-address sign-in limiter (`429 auth.rate_limited`, "Too many sign-in attempts; wait a minute."). It writes nothing.

**`POST /api/auth/reset`** (public; body `{ username, answer, newPassword }`, strict; `newPassword` 1 to 256 characters, `answer` at most 200 characters before normalisation)

Order of checks (the first two are the same for every username, so they reveal nothing):

1. **Body shape.** A `newPassword` outside 1 to 256 characters is `422 account.invalid` (field `newPassword`) for any username; this runs before any account lookup and counts nothing.
2. **Limiter.** `429 auth.rate_limited` for an address over ten a minute.
3. **Attempt state.** Read the row of `reset_attempts` for `usernameKey` (2.5). If its lock is in force (`locked_until > now`), the answer is `401 auth.reset_invalid` **without checking the answer** (a dummy verify runs); the correct answer is refused during the lock.
4. **The answer.** Normalise it, then `verifyPassword` against the account's `security_answer_hash`, or against the decoy hash when there is no account, no question or the account is disabled. A match is possible only for an enabled account with a question.
5. **Wrong answer** (or any branch of 4 that cannot match): increment `failed` for `usernameKey`; audit `auth.reset_failed` (detail `{ username }`, the typed username as `login_failed` does; never the answer). At 5 wrong answers, set `locked_until = now + 15 minutes`, reset `failed` to 0 and audit `auth.reset_locked` (detail `{ username }`). Answer `401 auth.reset_invalid`.
6. **Right answer, enabled account** (one transaction): store the new password's hash; `revokeAll(accountId)` (every access token ends by `session_version`, every refresh token is revoked: the account is signed out everywhere); clear `failed_sign_ins` and `locked_until` (the login lockout); delete the `reset_attempts` row; audit `auth.reset_completed` (actor: the account, detail `{ username }`). Answer `200 { reset: true }`.

**Every failure is one body:** `401 auth.reset_invalid`, message `That answer is not right, or the reset is not available for this username.` (The message is deliberately the same for a wrong answer, a lock, a decoy, an unknown username and a disabled account. A lock is not disclosed, because a disclosed lock would mark the username as a real account.)

**The account with no question.** The owner asked that `reset-start` tell such an account it has no question. It cannot, without revealing that a username is a real account with no question (an observer would learn that the username exists). The design answers with the decoy as in 2.4, and the gate shows a **generic** reason on every answer view (4.1), under the question: "If no security question was ever set for this account, it cannot be reset here: a signed-in admin must set one first, in the Accounts workspace." This is the only reason shown, for every username, so it discloses nothing. See 7, decision 1.

### 2.5 The attempt counter (`reset_attempts`)

- Keyed by `usernameKey`, **for every username**, known or unknown. So the lock behaves the same for a decoy and for a real account: five wrong answers lock the reset for that username for 15 minutes, whatever the username is. An attacker cannot tell a real locked account from an unknown username that was locked.
- A row whose lock has expired starts again from 0 on the next attempt (the expiry is checked, not timed). A successful reset deletes the row. Rows for usernames that are never used again stay (a few bytes each); the per-address limiter bounds how fast they grow.

### 2.6 Audit (names only)

| Action | Written when | Detail |
|---|---|---|
| `account.security_question_set` | a signed-in admin sets or changes an account's question (`54`; was `auth.security_question_set`, an account setting its own) | `{ username }` |
| `auth.reset_failed` | a wrong or refused answer (any username) | `{ username }` |
| `auth.reset_locked` | the fifth wrong answer | `{ username }` |
| `auth.reset_completed` | a successful reset | `{ username }`, actor the account |

Events drawer sentences: `<actor> set a security question for <username>` (`54`; the actor and the account are both admins, so both are named), `Password reset failed for <username>`, `Password reset locked for <username> after five wrong answers`, `<username> reset a password`. Names only: never an answer, a password, a hash or a question's answer.

## 3. Backend (`src/backend` only)

### 3.1 Migrations

`store/migrations/018-security-questions.sql` adds `security_question INTEGER CHECK (security_question BETWEEN 1 AND 8)` and `security_answer_hash TEXT` to `admin_accounts` and creates `reset_attempts (username_key PRIMARY KEY, failed, locked_until)` (as `email_key` at 018). Existing accounts get no question (NULL): see 5.1.

`store/migrations/019-username.sql` (the rename; `user_version` 19) renames `admin_accounts.email` to `username`, `admin_accounts.email_key` to `username_key`, `audit_log.actor_email` to `actor_username` and `reset_attempts.email_key` to `username_key`, and rewrites the audit details that name `email` to name `username`. Every value stays as it is (`owner@example.test` is now a username). No index or constraint names the old columns (the UNIQUE follows its column). The newer-schema rule (an older binary refuses a newer database) is unchanged.

### 3.2 Constants, types, errors

- `constants/security-questions.ts`: the eight questions (2.1), `SECURITY_QUESTION_COUNT = 8`, `SECURITY_ANSWER_MAX = 200`, `RESET_LOCK_FAILURES = 5`, `RESET_LOCK_MS = 15 * 60 * 1000`.
- `constants/errors.ts`: `authResetInvalid: { code: "auth.reset_invalid", status: 401, message: "That answer is not right, or the reset is not available for this username." }`; `accountUsernameTaken` (`account.username_taken`, 409, "Another account already uses that username."); `authInvalidCredentials` says "The username or password is wrong."
- `types/account.ts`: `username = z.string().trim().min(1).max(254)` (no regex); `AccountCreateSchema { username, name, password }`; `AccountPatchSchema` any of `username name password disabled`; `LoginSchema { username, password }`. `AdminAccount { id, username, name, disabled, createdAt, updatedAt, lastSignInAt?, securityQuestionSet }`.
- `types/security-question.ts`: `SecurityQuestionSetSchema { currentPassword, question 1..8, answer 1..200 }`, `ResetStartSchema { username (max 254) }`, `ResetSchema { username, answer (max 200), newPassword }` (all strict; `newPassword` is the password-change schema, 1 to 256).
- `bootstrap-username.ts`: the first admin's username is `ADMIN_BOOTSTRAP_USERNAME`, or `ADMIN_BOOTSTRAP_EMAIL` when only that old name is set.

### 3.3 Routes

| Route | Who | Body | Answer |
|---|---|---|---|
| `PUT /api/admin-accounts/:accountId/security-question` | signed in | `{ question, answer }` | `200 { set: true }`; `404 account.not_found`; `422 account.invalid` (field `answer` or `question`) |
| `POST /api/auth/reset-start` | anyone | `{ username }` | `200 { question }`; `429 auth.rate_limited` |
| `POST /api/auth/reset` | anyone | `{ username, answer, newPassword }` | `200 { reset: true }`; `401 auth.reset_invalid`; `422 account.invalid` (field `newPassword`); `429 auth.rate_limited` |

Routes parse, make one service call and return the envelope (`01` 4.3). The reset pair is under `/api/auth`, so its answers are `no-store`; the question route is an admin-accounts route (`54`). `03` 7.12 lists them and section 8 has `auth.reset_invalid`.

### 3.4 Backend tests

`security-question.test.ts`, `normalise.test.ts`, `reset.test.ts`, `reset-lock.test.ts`, `reset-migration.test.ts` (B3); `username-migration.test.ts` (an 018 database migrates with every account kept, the audit details renamed, the key still unique without case); `bootstrap-username.test.ts` (the new name wins, the old name is the fallback, via plain objects: no real `.env` is read); `accounts.test.ts` (username validation: trimmed, 1 to 254, any text, case-insensitive uniqueness on create and patch).

## 4. The admin (`src/admin`)

### 4.1 The gate: views, states and copy (`lib/reset-state.ts`, pure; `lib/gate-state.ts` untouched)

Views in the same full-window wall (`SignInPage`, which holds the reset state in a reducer): `signin` -> `reset-username` -> `reset-answer` -> `signin` (on success). No timer, no email, no code.

| View | Rows (top to bottom) | Verbs | What shows |
|---|---|---|---|
| `signin` | Username, Password | `Sign in` (unchanged reasons) | a ghost `InlineLink` **`Forgot password?`** right-aligned under the Password row; it opens `reset-username` with the typed username carried over |
| `reset-username` | Username | primary `Continue` (large, full width, disabled with `Enter your username.` while empty), ghost `Back to sign in` | heading `Reset your password`; pressing `Continue` calls `reset-start` |
| `reset-answer` | Question (read-only, the text answered), Answer, New password | primary `Reset password` (disabled with `Enter your answer.`, then `Enter a new password.`), ghost `Back to sign in` | a `GateNotice` card under the question with the generic reason of 2.4, identical for every username; Answer and New password are editable; an info glyph on Answer: "Answers are not case sensitive; extra spaces do not count." |

Copy (`constants/reset-copy.ts`):
- Heading `Reset your password`; verbs `Continue`, `Reset password`, `Back to sign in`; the link `Forgot password?`.
- The generic reason, always shown on `reset-answer`: `If no security question was ever set for this account, it cannot be reset here: a signed-in admin must set one first, in the Accounts workspace.` (card title `No security question?`).
- Refusals: `That answer is not right, or the reset is not available for this username.` under Answer (`auth.reset_invalid`); `Password must be at most 256 characters.` under New password (the client check first), `That password is not valid.` for the backend's `422`; `Too many sign-in attempts; wait a minute.` on a card (`rate_limited`); `The admin backend cannot be reached.` on a card (`unreachable`).
- Success: back to `signin` with the typed username kept and the card `Password reset` / `Password reset. Sign in.`
- Focus: Username on `reset-username`; Answer on `reset-answer`; after a refusal of the answer focus goes back to Answer (the answer and the new password are cleared; the question stays); after a refusal of the new password focus goes to New password and the answer is kept. The password field uses `autoComplete="new-password"`; the answer uses `autoComplete="off"`. Enter submits. Escape does nothing (a gate has no cancel).
- No placeholder text, no `aria-disabled`, the only filled button is the primary of each view. A disabled verb is natively `disabled` with its reason as a focusable tooltip.

### 4.2 The Accounts workspace's Security question group (amended by `54`; the Settings > Account page is gone)

Settings has three pages (Appearance, Session, About). The question is set per account in the Accounts workspace: a `Security question` group for the selected account (the last group, after Password), whose badge reads `Set` or `Not set` (from the account's `securityQuestionSet`; the Details group's fact row is gone). Rows: **Security question** (`Select` of the eight), **Answer** (typed in clear, `autoComplete="off"`). `Save question` is its own primary (not part of `Save details`), disabled with `Choose a question.`, `Enter your answer.`, `Saving.` or the unreachable sentence; a `422` sits under its row; a gone account closes the workspace as a details save does. Success empties the form (nothing is kept on screen) and flips the account's flag. Saving signs nothing out.

### 4.3 AuthPort additions (`types/auth.ts`, `services/auth-port.ts`, `services/session-api.ts`; additive)

```ts
type ResetStartResult = { ok: true; question: string } | { ok: false; refusal: "rate_limited" | "unreachable" };
type ResetResult = { ok: true } | { ok: false; refusal: "invalid" | "weak" | "rate_limited" | "unreachable" };
interface AuthPort {
  /* existing signIn, signOut */
  resetStart(username: string): Promise<ResetStartResult>;                                // POST /api/auth/reset-start, public layer
  resetPassword(username: string, answer: string, newPassword: string): Promise<ResetResult>; // POST /api/auth/reset, public layer
}
```
Both never reject. `lib/auth-errors.ts` has `resetRefusalFor(error)`: `auth.reset_invalid` -> `invalid`; `account.invalid` -> `weak`; `auth.rate_limited` -> `rate_limited`; a transport failure or a 5xx -> `unreachable`. The request layer treats a 401 `auth.invalid_credentials` (a wrong current password) as a plain refusal: no refresh, and the session is not ended. The Accounts workspace's `Save question` uses `PUT /api/admin-accounts/:accountId/security-question` through `services/accounts.ts`'s `saveQuestion` (`54`).
`hooks/useResetStart.ts` and `hooks/useResetPassword.ts` await the port; the store holds no promise; a second submit is ignored while waiting.

### 4.4 Files

`lib/reset-state.ts`, `lib/reset-verb.ts`, `constants/reset-copy.ts`, `components/session/{ResetUsernameForm,ResetAnswerForm,ForgotLink}.tsx`, `hooks/{useResetStart,useResetPassword}.ts`, `services/schemas/reset-schema.ts`; `components/settings/SecurityQuestionSection.tsx`, `constants/{security-questions,security-question-copy}.ts`, `lib/security-question-form.ts`, `services/security-question.ts`, `hooks/useSaveSecurityQuestion.ts`. Updated: `SignInForm`, `SignInPage`, `GateNotice` (a title and icon), `constants/settings-sections.ts`, `SettingsWindow`, `types/auth.ts`, `services/{auth-port,session-api}.ts`, `lib/{auth-errors,event-sentence}.ts`, `constants/api-sentences.ts`, `store/session-slice.ts` (the actor carries `securityQuestionSet`). (`54` deleted `SecurityQuestionSection`, `useSaveSecurityQuestion`, `services/security-question.ts`, `lib/security-question-form.ts` and `security-question-copy.ts`; the question group lives in `components/accounts/AccountQuestionGroup.tsx` with `lib/account-question.ts` and `services/account-question-flow.ts`.)

### 4.5 Admin tests

`reset-state.test.ts` (every transition, the verbs' reasons), `reset-copy.test.ts`, `reset-auth-port.test.ts` (bodies, the token-free layer, each refusal mapping, a wrong current password neither refreshes nor ends the session), `reset-markup.test.ts`, the security-question suite (the eight questions equal the backend's, the reasons in order, `Set` / `Not set`; re-homed by `54` into the accounts suites - `account-question-flow.test.ts` and the accounts markup tests), `event-sentence.test.ts`, `gate-markup.test.ts` (the link), `settings-sections.test.ts`; `gate-cover.test.ts` and `no-network-storage.test.ts` stay green.

## 5. Failure modes and their decisions

1. **An account set up before migration 018 has no question.** Migration `018` cannot invent an answer, so every existing account starts without one. Until its owner signs in and sets one, that account cannot be reset from the gate. **Consequence:** the owner should set a question now, while signed in (Settings > Account), before relying on the reset. A question-less account that forgets its password has no in-app recovery (see 7, decision 1).
2. **A `JWT_SECRET` change** changes every decoy question. An observer who saw the old decoy learns nothing new, and the real questions are unaffected. Accepted.
3. **Decoy and real questions** come from the same eight-item list, so the shape is the same. A real account's question is fixed; an unknown username's decoy is fixed per username; an observer who asks many usernames sees the same distribution for both.
4. **A wrong answer is guessable** if the question is common (for example the favourite book). The five-wrong lock per username and the per-address limit bound a guessing run to about five attempts per 15 minutes per username. Accepted: the picklist is a convenience, and the owner may prefer a stronger question.
5. **A disabled account** is answered as the decoy path (2.4 step 4): no reset, no revealed difference. The owner re-enables it from another account, then resets.
6. **The only account is locked out with no question set** (decision 1): there is no in-app recovery. The owner can still sign in on the same machine if the password is remembered; otherwise the database must be changed by hand. By design, no hidden path exists.
7. **The lock is silent** (the same sentence for a locked and a wrong answer). A real person can be confused after five mistakes; the sentence says only that the answer is not right, and the 15 minutes pass on their own.
8. **Clock changes** move expiry of the lock only; the lock is a stored time, checked on use.
9. **Usernames are not secret.** The gate and the audit show them; two accounts cannot differ only by case. A username that looks like an email is only text (nothing is ever sent).

## 6. Acceptance (coordinator; temporary backend of `39` section 9, port 8397)

1. **Backend over HTTP (no browser).** A temp `DATA_DIR` with the test bootstrap owner. Sign in as the owner, `PUT /api/auth/me/security-question` with the current password and question 1 and answer `Rex`. Then, unauthenticated: `reset-start` for the owner answers the question 1 text; `reset-start` for an unknown username answers a decoy text with the same shape, and the same username always answers the same text; `reset` with `  rex ` and a new password answers `200`; the old password fails; the new one signs in; the old refresh token answers `auth.refresh_invalid`; the same reset again is `401 auth.reset_invalid`; five wrong answers lock the reset and the sixth correct one is refused; an unknown username locked the same way answers identically; every failure body is byte-identical; no response contains the answer.
2. **Admin in Chrome** at 1600 x 1000 and 900 x 640, dark and light, on the temp backend: `Forgot password?` opens the username view with the typed username carried over; `Continue` shows the question (the same view for an unknown username); the generic reason is shown; a wrong answer shows its sentence under Answer, the answer and new password are cleared, focus returns to Answer; a 257-character new password shows its sentence under New password and the answer is kept; the right answer resets and returns to the sign-in view with `Password reset. Sign in.`; the new password signs in; Settings > Account shows `Set` and saves a new question with the current password, and a wrong current password shows its sentence under Current password without signing out; console clean; every reset request carries no `Authorization`; nothing is written to browser storage.
3. **No real reset on the owner's backend.** The coordinator never runs a reset against the owner's data. It may look at the gate and at Settings > Account on the owner's stack (UI state only), without saving.
4. **The rename on the owner's data.** Start the new backend on a copy of the owner's database: it migrates to 19, `owner@example.test` and `dev@example.test` are now usernames and still sign in (the owner's `.env` may still say `ADMIN_BOOTSTRAP_EMAIL`; it is read as a fallback and used only when there are no accounts).
5. Cleanup as `39` section 9: the temp backend stopped by PID, its folder deleted, the owner's data untouched.

## 7. Open decisions for the owner

| # | Decision | Default taken |
|---|---|---|
| 1 | The reason shown for a question-less account is generic (on every answer), not "this account has no question". Saying it per account would tell an observer which usernames are real accounts. | generic, as 4.1; the owner may accept the disclosure if they prefer the literal reason |
| 2 | The question is a fixed picklist of eight, not free text | picklist, because free text would make real accounts distinguishable from decoys |
| 3 | Existing accounts start with no question (migration 018 cannot invent one) | the owner sets one for each account while signed in; no account is recoverable until it does |
| 4 | Only an account may set its own question (another admin cannot set it for a locked-out person) | own account only; the owner can revisit if a reset of another account's question is wanted |
| 5 | Email delivery is not part of this design, and sign-in is no longer by email | none planned; the sign-in name is a username (owner, 2026-10-17) |

## 8. Doc against code: differences found

| # | Doc says | Code does |
|---|---|---|
| 1 | `34` 3 and 5: no forgot-password link and no text link on the gate | superseded (owner, 2026-10-17): a `Forgot password?` link and the reset views (4.1) |
| 2 | `03` 7.12 lists five auth routes | gains `PUT /api/auth/me/security-question`, `reset-start`, `reset` (3.3); section 8 gains `auth.reset_invalid` |
| 3 | `29` 6.1: a sign-in failure has three kinds | the reset views add `auth.reset_invalid` and the `weak` password refusal |
| 4 | `tray-menu.ts` pins two entries | unchanged: no tray action is added by this design |
| 5 | `01` 4.4: no timers | the lock is a stored time checked on use; nothing is armed |
| 6 | `03` 7.11: an account has an email, a name, a password and `disabled` | a username (migration 019), a name, a password and `disabled`, plus `security_question` and `security_answer_hash` (migration 018) and the read-only `securityQuestionSet` answer field |
| 7 | `03` 7.12: `auth.locked` is a 429 on sign-in only | the reset lock is silent (`auth.reset_invalid`, 401), so an observer cannot tell a locked username from an unknown one |
| 8 | the earlier text of this document: "A `newPassword` of 11 characters is `422`" and "12 to 256" | stale since the password rule became 1 to 256 (`35`): the body refusal is a `newPassword` outside 1 to 256 characters |
| 9 | the earlier text of 4.1: a `Password reset. Sign in with the new password.` notice | the notice is `Password reset. Sign in.` (owner's wording for wave R) |
| 10 | the earlier text of 4.3: the signed layer ends the session on any 401 | a 401 `auth.invalid_credentials` (a wrong current password) is a plain refusal; only `auth.unauthorized` and the other 401s refresh, then end the session |
