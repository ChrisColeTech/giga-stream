# 40 - Admin password reset by security question (Waves B3 and R)

**Status: plan, written before the code (backend worker B3, branch `backend/reset`; admin worker R, branch `admin/reset-gate`). This document replaces the earlier email and local-code design in full.** Owner, 2026-10-17: "add a password reset button to the login form", then "lets do security question instead of email for password reset." There is no email, no SMTP, no reset code, no console sink, no Electron dialog and no tray action. The reset is answered by a **security question** that each account sets for itself while signed in. The program is `39` (B3 is the next backend wave and takes migration `018`; R runs in parallel with Waves 3b to 3d once 3a and B3 have landed). Governed by `00`, `01`, `03` 7.11 and 7.12, `07`, `26` (D5, D22), `34`.

## 1. What exists (verified in source, `family-port`)

| Piece | Where |
|---|---|
| Accounts with a scrypt password hash (`hashPassword`, `verifyPassword`, a `decoyHash` for unknown emails), `session_version`, `failed_sign_ins`, `locked_until` | `store/account-repository.ts`, `services/password.ts`, `services/auth-service.ts` |
| `revokeAll(accountId)`: bumps `session_version` and revokes every refresh token | `services/auth-service.ts` |
| The sign-in limiter (ten a minute per address, in memory) | `services/sign-in-limiter.ts` |
| The lockout on five wrong passwords (15 minutes), audited as `auth.login_failed` with the typed email | `services/auth-service.ts` |
| The audit log, `Actor`, `actorOf(request)`, `signedIn(services, request)` | `services/audit-service.ts`, `api/guard.ts` |
| `changePassword` (signed in, current password checked, `auth.invalid_credentials` with `details.field` on a wrong current password) | `services/auth-service.ts`, `api/auth.ts` |
| The admin gate: `SignInPage`, `SignInForm`, `GateNotice`, `lib/gate-state.ts`, `AuthPort`, `createAuthPort` | `src/admin/src/...` (`34`) |
| Settings window pages: Appearance, Session, About (no account page yet) | `src/admin/src/constants/settings-sections.ts`, `components/settings/*` |

Nothing in the backend or the admin has a reset route today.

## 2. The design

**Each account sets one security question and its answer. A reset asks the question and, when the answer is right, sets a new password.** No message leaves the backend by any channel other than the HTTP answers the person asks for.

### 2.1 The question

- **A fixed picklist of eight questions**, held in `constants/security-questions.ts` and numbered 1 to 8 (`security_question` stores the number). Free text is refused: a custom question would look different from the decoy questions of 2.4, which would let an observer tell a real account from an unknown email. The owner may overrule (open decision 2).
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

### 2.3 Setting or changing the question (signed in, own account only)

- Route `PUT /api/auth/me/security-question`, body `{ currentPassword, question, answer }` (strict). The **current password is required** (a wrong one is `401 auth.invalid_credentials` with `details.field: "currentPassword"`, the same as the password change).
- An account can set or change only its **own** question. Another admin cannot set it: the owner's rule is that an account's question is its own, so a locked-out person is never handed a question by someone else. A question is never removed by a route (an account with no question stays without one until it sets one).
- Changing the question does **not** end sessions (it is not a credential change). Audit `auth.security_question_set` (actor: the account; detail `{ email }`; never the answer).
- Answer `200 { set: true }`.

### 2.4 Resetting: `reset-start` and `reset`

The enumeration rule: **an answer never differs by whether the email is an account, whether that account has a question, or whether it is disabled.** Every branch below produces the same shape and the same timing (a dummy `verifyPassword` runs on each branch that has no real hash to check, as `login` does with `decoyHash`).

**The decoy question.** For an email with no account, or an account with no question, the question shown is `SECURITY_QUESTIONS[n]`, where `n = HMAC-SHA256(JWT_SECRET, "reset-decoy:" + emailKey)` taken as an unsigned integer modulo 8. `emailKey` is the email trimmed and lower-cased (the backend's own `email_key`). It is stable: the same email always gets the same decoy question. A `JWT_SECRET` change changes the decoys (noted in 5).

**`POST /api/auth/reset-start`** (public; body `{ email }`, strict, at most 254 characters)

- Answer `200 { question: "<the question text>" }` for **every** email: the account's real question when it has one and is enabled; the decoy otherwise (unknown email, account with no question, disabled account). The disabled case uses the real question, which is shape-identical to a decoy, so nothing is revealed.
- Passes through the per-address sign-in limiter (`429 auth.rate_limited`, "Too many sign-in attempts; wait a minute."). It writes nothing.

**`POST /api/auth/reset`** (public; body `{ email, answer, newPassword }`, strict; `newPassword` 12 to 256 characters, `answer` 1 to 200 characters before normalisation)

Order of checks (the first two are the same for every email, so they reveal nothing):

1. **Body shape.** A `newPassword` of 11 characters is `422 account.invalid` (field `newPassword`) for any email; this runs before any account lookup and counts nothing.
2. **Limiter.** `429 auth.rate_limited` for an address over ten a minute.
3. **Attempt state.** Read the row of `reset_attempts` for `emailKey` (2.5). If its lock is in force (`locked_until > now`), the answer is `401 auth.reset_invalid` **without checking the answer** (a dummy verify runs); the correct answer is refused during the lock.
4. **The answer.** Normalise it, then `verifyPassword` against the account's `security_answer_hash`, or against the decoy hash when there is no account, no question or the account is disabled. A match is possible only for an enabled account with a question.
5. **Wrong answer** (or any branch of 4 that cannot match): increment `failed` for `emailKey`; audit `auth.reset_failed` (detail `{ email }`, the typed email as `login_failed` does; never the answer). At 5 wrong answers, set `locked_until = now + 15 minutes`, reset `failed` to 0 and audit `auth.reset_locked` (detail `{ email }`). Answer `401 auth.reset_invalid`.
6. **Right answer, enabled account** (one transaction): store the new password's hash; `revokeAll(accountId)` (every access token ends by `session_version`, every refresh token is revoked: the account is signed out everywhere); clear `failed_sign_ins` and `locked_until` (the login lockout); delete the `reset_attempts` row; audit `auth.reset_completed` (actor: the account, detail `{ email }`). Answer `200 { reset: true }`.

**Every failure is one body:** `401 auth.reset_invalid`, message `That answer is not right, or the reset is not available for this email.` (The message is deliberately the same for a wrong answer, a lock, a decoy, an unknown email and a disabled account. A lock is not disclosed, because a disclosed lock would mark the email as a real account.)

**The account with no question.** The owner asked that `reset-start` tell such an account it has no question. It cannot, without revealing that an email is a real account with no question (an observer would learn that the email exists). The design answers with the decoy as in 2.4, and the gate shows a **generic** reason on every answer view (4.1): "If this account has no security question, it cannot be reset here. A signed-in admin can set one: Settings > Account." This is the only reason shown, for every email, so it discloses nothing. See 7, decision 1.

### 2.5 The attempt counter (`reset_attempts`)

- Keyed by `emailKey`, **for every email**, known or unknown. So the lock behaves the same for a decoy and for a real account: five wrong answers lock the reset for that email for 15 minutes, whatever the email is. An attacker cannot tell a real locked account from an unknown email that was locked.
- A row whose lock has expired starts again from 0 on the next attempt (the expiry is checked, not timed). A successful reset deletes the row. Rows for emails that are never used again stay (a few bytes each); the per-address limiter bounds how fast they grow.

### 2.6 Audit (names and emails only)

| Action | Written when | Detail |
|---|---|---|
| `auth.security_question_set` | a signed-in account sets or changes its question | `{ email }` |
| `auth.reset_failed` | a wrong or refused answer (any email) | `{ email }` |
| `auth.reset_locked` | the fifth wrong answer | `{ email }` |
| `auth.reset_completed` | a successful reset | `{ email }`, actor the account |

Events drawer sentences: `<email> set a security question`, `Password reset failed for <email>`, `Password reset locked for <email> after five wrong answers`, `<email> reset a password`. Names only: never an answer, a password, a hash or a question's answer.

## 3. Backend (worker B3; `src/backend` only)

### 3.1 Migration `store/migrations/018-security-questions.sql`

```sql
ALTER TABLE admin_accounts ADD COLUMN security_question INTEGER CHECK (security_question BETWEEN 1 AND 8);
ALTER TABLE admin_accounts ADD COLUMN security_answer_hash TEXT;
CREATE TABLE reset_attempts (
  email_key    TEXT PRIMARY KEY,                    -- the normalised email the attempts belong to; known or unknown
  failed       INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER
);
```

No existing table's key changes. The reset answers never show an account id; the reset is keyed by the email.

Existing accounts get no question (NULL): see 5.1. `user_version` becomes at least 18 (the last migration today is `017-admin-ui-state.sql`). The newer-schema rule (an older binary refuses a newer database) is unchanged.

### 3.2 Constants, types, errors

- `constants/security-questions.ts`: the eight questions (2.1), `SECURITY_QUESTION_COUNT = 8`, `SECURITY_ANSWER_MAX = 200`, `RESET_LOCK_FAILURES = 5`, `RESET_LOCK_MS = 15 * 60 * 1000`.
- `constants/errors.ts`: `authResetInvalid: { code: "auth.reset_invalid", status: 401, message: "That answer is not right, or the reset is not available for this email." }`.
- `types/account.ts`: `SecurityQuestionSetSchema = z.object({ currentPassword, question: z.number().int().min(1).max(8), answer: z.string().min(1).max(200) }).strict()`; `ResetStartSchema = z.object({ email: z.string().max(254) }).strict()`; `ResetSchema = z.object({ email, answer: z.string().max(200), newPassword: password })` (`password` is the existing 12-to-256 schema, so a short password is the body refusal of 2.4 step 1).
- `AdminAccount` gains `securityQuestionSet: boolean` (read-only, for the Accounts workspace's Details row, `35`).
### 3.3 Service, repositories and routes

- `store/account-repository.ts`: `setSecurityQuestion(id, question, answerHash, at)`, `clearAttempts`, and the two fields on `StoredAccount` (`securityQuestion`, `securityAnswerHash`).
- `store/reset-attempts-repository.ts` (SQL only here): `find(emailKey)`, `recordFailure(emailKey, failed, lockedUntil)`, `remove(emailKey)`.
- `services/security-question-service.ts`: `set(principal, currentPassword, question, answer, actor)`; `questionFor(email)` (the real or decoy text, 2.4); `start(email)`; `reset(email, answer, newPassword, actor)`. The decoy is `createHmac("sha256", secret)`; the decoy hash is computed once at start, like `decoyHash`.
- `api/auth-security.ts` (registered after `registerAuth`):

| Route | Who | Body | Answer |
|---|---|---|---|
| `PUT /api/auth/me/security-question` | signed in | `{ currentPassword, question, answer }` | `200 { set: true }`; `401 auth.invalid_credentials` (field `currentPassword`); `422 account.invalid` (field `answer` or `question`) |
| `POST /api/auth/reset-start` | anyone | `{ email }` | `200 { question }`; `429 auth.rate_limited` |
| `POST /api/auth/reset` | anyone | `{ email, answer, newPassword }` | `200 { reset: true }`; `401 auth.reset_invalid`; `422 account.invalid` (field `newPassword`); `429 auth.rate_limited` |

Routes parse, make one service call and return the envelope (`01` 4.3). All three are under `/api/auth`, so they are `no-store` (`isPrivateRoute`). `03` 7.12 gains the three routes and section 8 gains `auth.reset_invalid`.

### 3.4 Tests (written AND run by B3; temporary `DATA_DIR`; a hand-moved clock; no network)

`security-question.test.ts`: a signed-in account sets its question with its current password; a wrong current password is `401 auth.invalid_credentials` with `field: currentPassword` and changes nothing; an empty answer after normalisation is `422`; a question outside 1 to 8 is `422`; setting does not revoke sessions; another account cannot set it (the route takes no account id); audit `auth.security_question_set` has no answer in it.
`normalise.test.ts`: `  Rex  `, `rex`, `REX` are one answer; `Golden   Retriever` equals `golden retriever`; NFKC folds a full-width letter; an empty result is refused.
`reset.test.ts`: `reset-start` answers the same shape for a known account with a question, an unknown email, an account with no question and a disabled account; the decoy is the same question on every call for the same email and differs between two emails (over enough emails both decoy values occur); the real question is returned for a real account; `reset` with the right answer sets the password (the old one fails, the new one signs in), revokes every refresh token and every access token (`ver`), clears the login lockout, deletes the attempt row, audits `auth.reset_completed`; a wrong answer is `401 auth.reset_invalid` and audits `auth.reset_failed`; the fifth wrong answer audits `auth.reset_locked` and sets the lock; during the lock the right answer is `401 auth.reset_invalid` and checks nothing; after 15 minutes (clock moved) a right answer works; the same five wrong answers on an **unknown** email lock it identically; every failure body is byte-identical (unknown, wrong, locked, decoy, disabled, no question); `newPassword` of 11 characters is `422` before any lookup and counts nothing (the attempt row is unchanged); the limiter answers `429` after ten requests in a minute, for both routes; the stored answer is a scrypt hash and no response or audit detail contains the answer.
`reset-migration.test.ts`: `018` applies on a `017` database, `user_version` is at least 18, existing accounts have a NULL question, and an 018 database is refused by the older binary (the existing newer-schema rule).

## 4. The admin (worker R; `src/admin`)

### 4.1 The gate: views, states and copy (`lib/reset-state.ts`, pure; `lib/gate-state.ts` untouched)

Views in the same full-window wall (`SignInPage`): `signin` -> `reset-email` -> `reset-answer` -> `signin` (on success). No timer, no email, no code.

| View | Rows (top to bottom) | Verbs | What shows |
|---|---|---|---|
| `signin` | Email, Password | `Sign in` (unchanged reasons) | a ghost `InlineLink` **`Forgot password?`** right-aligned under the Password row; it opens `reset-email` with the typed email carried over |
| `reset-email` | Email | primary `Continue` (large, full width, disabled with `Enter your email.` while empty), ghost `Back to sign in` | heading `Reset your password`; pressing `Continue` calls `reset-start` |
| `reset-answer` | Question (read-only, the text answered), Answer, New password | primary `Reset password` (disabled with `Enter your answer.`, then `Enter a new password.`), ghost `Back to sign in` | the `GateNotice` card with the generic reason of 2.4 on every answer, identical for every email; Answer and New password are editable; an info glyph on Answer: "Answers are not case sensitive; extra spaces do not count." |

Copy (`constants/reset-copy.ts`):
- Heading `Reset your password`; verbs `Continue`, `Reset password`, `Back to sign in`.
- The generic reason, always shown on `reset-answer`: `If this account has no security question, it cannot be reset here. A signed-in admin can set one under Settings > Account.`
- Refusals: `That answer is not right, or the reset is not available for this email.` under Answer (`auth.reset_invalid`); `Password must be at least 12 characters.` under New password (the client check first, then the backend's `422`); `Too many sign-in attempts; wait a minute.` on the notice (`rate_limited`); `The admin backend cannot be reached.` on the notice (`unreachable`).
- Success: back to `signin` with the notice `Password reset. Sign in with the new password.` (`GateNotice`, title `Password reset`).
- Focus: Email on `reset-email`; Answer on `reset-answer`; after a refusal focus goes back to Answer (the answer is cleared on a refusal, the new password is cleared too; the question stays). The password fields use `autoComplete="new-password"`; the answer uses `autoComplete="off"`. Escape does nothing (a gate has no cancel).
- No placeholder text, no `aria-disabled`, the only filled button is the primary of each view.

### 4.2 Settings > Account (the owner's own question)

A new page in the Settings window, added to `constants/settings-sections.ts` as **Account** (between Session and About). The page holds one group, `Security question`: rows in this order: **Security question** (`Select` of the eight, the row switcher is not used), **Answer** (`type=password` is not used: the answer is typed in clear, `autoComplete="off"`, with the info glyph "Used only to reset your password from the sign-in page."), **Current password** (`type=password`). `Save question` is the one primary, disabled with `Choose a question.`, `Enter your answer.` or `Enter your current password.` as the first missing field; `Saving.` while it runs. A wrong current password is shown under that row. The page shows `Set` or `Not set` as a read-only fact, from `securityQuestionSet`. Saving signs nothing out.

### 4.3 AuthPort additions (`types/auth.ts`, `services/auth-port.ts`, `services/session-api.ts`; additive)

```ts
type ResetStartResult = { ok: true; question: string } | { ok: false; refusal: "rate_limited" | "unreachable" };
type ResetResult = { ok: true } | { ok: false; refusal: "invalid" | "weak" | "rate_limited" | "unreachable" };
interface AuthPort {
  /* existing signIn, signOut */
  resetStart(email: string): Promise<ResetStartResult>;                          // POST /api/auth/reset-start, public layer
  resetPassword(email: string, answer: string, newPassword: string): Promise<ResetResult>; // POST /api/auth/reset, public layer
}
```
Both never reject. `session-api.ts` gains `resetStart` and `reset` on its token-free layer. `lib/auth-errors.ts` gains `resetRefusalFor(error)`: `auth.reset_invalid` -> `invalid`; `account.invalid` -> `weak`; `auth.rate_limited` -> `rate_limited`; a transport failure or a 5xx -> `unreachable`. `constants/api-sentences.ts` gains `auth.reset_invalid` (R owns that one line). The Settings > Account page uses `PUT /api/auth/me/security-question` through the signed layer (`services/accounts.ts` is 3a's, so the call lives in `services/security-question.ts`, owned by R).
`hooks/useResetStart.ts` and `hooks/useResetPassword.ts` await the port; the store holds no promise; a second submit is ignored while `submitting`.

### 4.4 Files (R)

Create: `lib/reset-state.ts`, `constants/reset-copy.ts`, `constants/security-questions.ts` (the picklist labels for the Select, mirroring the backend's eight), `components/session/ResetEmailForm.tsx`, `components/session/ResetAnswerForm.tsx`, `components/session/ForgotLink.tsx`, `components/settings/SecurityQuestionSection.tsx`, `services/security-question.ts`, `hooks/useResetStart.ts`, `hooks/useResetPassword.ts`. Update: `components/session/SignInForm.tsx` (the link), `pages/SignInPage.tsx` (the view switch), `constants/settings-sections.ts` (the Account page), `components/settings/SettingsWindow` only where the new page is drawn, `types/auth.ts`, `services/auth-port.ts`, `services/session-api.ts`, `lib/auth-errors.ts`, `constants/sign-in-copy.ts` (the success notice), `constants/api-sentences.ts`. R owns these files; Wave 4 (`39` section 4) must not edit `constants/settings-sections.ts`.

### 4.5 Tests (written AND run by R)

`reset-state.test.ts` (every transition: forgot, back, continue, submit twice, each refusal, the carried email); `reset-copy.test.ts` (every sentence word for word, the generic reason present on every answer view); `reset-auth-port.test.ts` (the two calls over the fake backend: bodies, the token-free layer, each refusal mapping, a rejected fetch is `unreachable`, a `422` is `weak`); `security-question-section.test.ts` (the rows in order, `Save question` reasons in priority order, `Set` / `Not set`); `reset-markup.test.ts` (the `Forgot password?` link on the sign-in view; the email view's one row and verbs; the answer view's rows in order, the read-only question, `new-password` and `off` autocomplete, the notice card, the refusal under the Answer row with `role="alert"`; no placeholder, no `aria-disabled`); `gate-cover.test.ts` and `no-network-storage.test.ts` stay green.

## 5. Failure modes and their decisions

1. **An account set up before this migration has no question.** Migration `018` cannot invent an answer, so every existing account starts without one. Until its owner signs in and sets one, that account cannot be reset from the gate. **Consequence:** the owner should set a question now, while signed in (Settings > Account), before relying on the reset. A question-less account that forgets its password has no in-app recovery (see 7, decision 1).
2. **A `JWT_SECRET` change** changes every decoy question. An observer who saw the old decoy learns nothing new, and the real questions are unaffected. Accepted.
3. **Decoy and real questions** come from the same eight-item list, so the shape is the same. A real account's question is fixed; an unknown email's decoy is fixed per email; an observer who asks many emails sees the same distribution for both.
4. **A wrong answer is guessable** if the question is common (for example the favourite book). The five-wrong lock per email and the per-address limit bound a guessing run to about five attempts per 15 minutes per email. Accepted: the picklist is a convenience, and the owner may prefer a stronger question.
5. **A disabled account** is answered as the decoy path (2.4 step 4): no reset, no revealed difference. The owner re-enables it from another account, then resets.
6. **The only account is locked out with no question set** (decision 1): there is no in-app recovery. The owner can still sign in on the same machine if the password is remembered; otherwise the database must be changed by hand. By design, no hidden path exists.
7. **The lock is silent** (the same sentence for a locked and a wrong answer). A real person can be confused after five mistakes; the sentence says only that the answer is not right, and the 15 minutes pass on their own.
8. **Clock changes** move expiry of the lock only; the lock is a stored time, checked on use.

## 6. Acceptance (coordinator; temporary backend of `39` section 9, port 8397)

1. **Backend over HTTP (no browser).** A temp `DATA_DIR` with the test bootstrap owner. Sign in as the owner, `PUT /api/auth/me/security-question` with the current password and question 1 and answer `Rex`. Then, unauthenticated: `reset-start` for the owner answers the question 1 text; `reset-start` for an unknown email answers a decoy text with the same shape, and the same email always answers the same text; `reset` with `  rex ` and a 12-character password answers `200`; the old password fails; the new one signs in; the old refresh token answers `auth.refresh_invalid`; the same reset again is `401 auth.reset_invalid`; five wrong answers lock the reset and the sixth correct one is refused; an unknown email locked the same way answers identically; every failure body is byte-identical; no response contains the answer.
2. **Admin in Chrome** at 1600 x 1000 and 900 x 640, dark and light, on the temp backend: `Forgot password?` opens the email view with the typed email carried over; `Continue` shows the question (the same view for an unknown email); the generic reason is shown; a wrong answer shows its sentence under Answer, the answer and new password are cleared, focus returns to Answer; a short new password shows its sentence under New password and the answer is kept; the right answer resets and returns to the sign-in view with `Password reset. Sign in with the new password.`; the new password signs in; Settings > Account shows `Set` and saves a new question with the current password; console clean; every reset request carries no `Authorization`; nothing is written to browser storage.
3. **No real reset on the owner's backend.** The coordinator never runs a reset against the owner's data. It may look at the gate and at Settings > Account on the owner's stack (UI state only), without saving.
4. Cleanup as `39` section 9: the temp backend stopped by PID, its folder deleted, the owner's data untouched.

## 7. Open decisions for the owner

| # | Decision | Default taken |
|---|---|---|
| 1 | The reason shown for a question-less account is generic (on every answer), not "this account has no question". Saying it per account would tell an observer which emails are real accounts. | generic, as 4.1; the owner may accept the disclosure if they prefer the literal reason |
| 2 | The question is a fixed picklist of eight, not free text | picklist, because free text would make real accounts distinguishable from decoys |
| 3 | Existing accounts start with no question (migration 018 cannot invent one) | the owner sets one for each account while signed in; no account is recoverable until it does |
| 4 | Only an account may set its own question (another admin cannot set it for a locked-out person) | own account only; the owner can revisit if a reset of another account's question is wanted |
| 5 | Email delivery is not part of this design | none planned; a later option only if the owner asks |

## 8. Doc against code: differences found (2026-10-17)

| # | Doc says | Code does |
|---|---|---|
| 1 | `34` 3 and 5: no forgot-password link and no text link on the gate | superseded (owner, 2026-10-17): a `Forgot password?` link and a reset view (4.1) |
| 2 | `03` 7.12 lists five auth routes | gains `PUT /api/auth/me/security-question`, `reset-start`, `reset` (3.3); section 8 gains `auth.reset_invalid` |
| 3 | `29` 6.1: a sign-in failure has three kinds | the reset views add `auth.reset_invalid` and the `weak` password refusal |
| 4 | `tray-menu.ts` pins two entries | unchanged: no tray action is added by this design |
| 5 | `01` 4.4: no timers | the lock is a stored time checked on use; nothing is armed |
| 6 | `03` 7.11: an account has an email, a name, a password and `disabled` | gains `security_question` and `security_answer_hash` (migration 018) and the read-only `securityQuestionSet` answer field |
| 7 | `03` 7.12: `auth.locked` is a 429 on sign-in only | the reset lock is silent (`auth.reset_invalid`, 401), so an observer cannot tell a locked email from an unknown one |
