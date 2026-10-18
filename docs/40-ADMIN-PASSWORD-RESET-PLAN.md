# 40 - Admin password reset plan (Waves B3 and R)

**Status: plan, written before the code (backend worker B3, branch `backend/reset`; admin worker R, branch `admin/reset-gate`).** Owner, 2026-10-17: "add a password reset button to the login form." Today the backend has **no
reset route, no email and no SMTP** (`03` 7.12 lists login, refresh, logout, me and the signed-in password change; `services/auth-service.ts` verified), and `34` drew the gate with "no forgot password". This document adds a
**Forgot password?** link to the full-window gate that opens a reset view in the same wall: email, then a code and a new password. The program is `39` (B3 takes migration `019`, merged after B2's `018`; R runs in parallel with Waves 3b to 3d
once Wave 3a and B3 have landed). Governed by `00`, `01`, `03` 7.11 and 7.12, `07`, `26` (D5, D22), `34`.

## 1. What exists (verified in source)

| Piece | Where |
|---|---|
| Accounts with a scrypt password hash, `session_version`, `failed_sign_ins`, `locked_until` | `store/account-repository.ts`, `services/password.ts` |
| `revokeAll(accountId)`: bumps `session_version` and revokes every refresh token | `services/auth-service.ts` |
| The sign-in limiter (ten a minute per address, in memory) and the lockout | `services/sign-in-limiter.ts`, `auth-service.ts` |
| The audit log, `Actor`, `actorOf(request)` | `services/audit-service.ts`, `api/guard.ts` |
| The backend's Electron host: window, tray (`Open`, `Quit`), native folder dialog IPC, in-process `buildApp()` | `src/backend/src/app/{main,backend-host,tray,tray-menu,native-dialog}.ts` |
| The gate: `SignInPage`, `SignInForm`, `GateNotice`, `lib/gate-state.ts`, `AuthPort`, `createAuthPort` | `src/admin/src/...` (`34`) |

## 2. The design (default taken by the coordinator; justified)

**A single-use reset code that the backend shows only on its own local surfaces, never in an HTTP answer.**

- **Why not email:** the backend has no mail transport, and adding one means credentials, deliverability and a secret the owner must manage. A local code needs none of that and is safe by construction: whoever can read it is already at the machine (or its logs) that holds the
  database. It matches how the first account already works (the bootstrap owner is set in the backend's own environment). **Email delivery is a later option** for the owner (open decision).
- **Where the code appears:** (1) the backend's console log (one line); (2) the backend's Electron window: a native dialog opens when a code is issued and the tray item **`Reset a password...`** re-opens the list of pending codes. Neither surface is reachable over HTTP. When the backend runs
  headless (`npm start`) only the console exists; when the Electron window only *attaches* to a separate backend, only that backend's console does (the tray item says so).
- **The code:** 10 characters of Crockford base32 (no I, L, O or U), about 50 bits, shown grouped `ABCDE-FGHJK`, entered case-insensitively with the dash optional. Long enough that a leaked hash cannot be brute-forced offline; short enough to type.
- **At rest:** `HMAC-SHA256(JWT_SECRET, salt || code)` with a random 16-byte salt per code; the plaintext is never stored. It exists in the process memory (the local sink) only until it is used or expires, so the tray can re-show it. A restart forgets pending codes; changing `JWT_SECRET` voids them.
- **Lifetime and attempts:** valid 15 minutes (a stored `expires_at`, checked on use; no timer), **five wrong tries then it is burned** (the row is deleted), single use. **One active code per account:** a new request replaces the old row.
- **Rate limits:** the existing per-address sign-in limiter covers both routes (ten a minute, `429 auth.rate_limited`); per account, a new code is issued at most once every 60 seconds (a request inside that window is accepted and answered the same, and issues nothing).
- **No enumeration:** `reset-request` answers `202 { requested: true }` for every email, known, unknown or disabled, with the same work done (a dummy hash on the unknown path) and the same time to within noise. `reset` answers one `401 auth.reset_invalid` for an unknown email, a disabled account, a wrong, expired, burned or used code.
- **Success** (inside one transaction): the new password's scrypt hash is stored, **`revokeAll`** bumps `session_version` and revokes every refresh token (the account is signed out everywhere), the lockout (`failed_sign_ins`, `locked_until`) is cleared, the code row is deleted, the sink forgets it.
- **Audit (names only, never the code or the password):** `auth.reset_requested` (detail `{ email, known }`), `auth.reset_failed` (detail `{ email }`), `auth.reset_completed` (the account as actor). The Events drawer sentences: `<email> asked to reset a password`, `Password reset failed for <email>`, `<actor> reset a password`.
- **Abuse:** anyone who can reach the HTTP port can make the owner's machine pop a dialog; the limiter and the 60-second per-account cooldown bound it, and the dialog is informational (it grants nothing to the requester, who cannot see it). A password manager or log shipper that captures the console would capture a code that is valid for 15 minutes and once; the owner keeps the console private.

## 3. Backend (worker B3; `src/backend` only; migration `019-password-resets.sql`)

### 3.1 Migration and repository

```sql
CREATE TABLE password_resets (
  account_id TEXT PRIMARY KEY REFERENCES admin_accounts (id) ON DELETE CASCADE,   -- one active code per account
  salt       TEXT NOT NULL,
  code_hash  TEXT NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  issued_at  INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
```

`store/reset-repository.ts` (SQL only here): `find(accountId)`, `upsert(row)` (replaces), `countAttempt(accountId)` (returns the new count), `remove(accountId)`.

### 3.2 Service (`services/reset-service.ts`) and sink (`services/reset-sink.ts`)

`createResetService({ store, audit, auth (revokeAll), accounts, sink, secret, limiter, now, random })`:
`request(email, actor)` -> `{ requested: true }`; `reset(email, code, newPassword, actor)` -> `{ reset: true }`. `normalise(code)` upper-cases, drops spaces and dashes, maps `O`->`0`, `I` and `L`->`1`, `U`->`V` (Crockford). Comparison is `timingSafeEqual`. The order inside `reset`: limiter; find the account and row (a decoy compare when absent); a wrong code counts an attempt and burns at five; a **right code with a weak new password** answers `422 account.invalid` (field `newPassword`) **without** counting an attempt or consuming the code; a right code with a valid password runs the success transaction.

`createResetSink()` is in-memory: `publish({ accountId, email, code, expiresAt })`, `pending(now)` (prunes the expired on access; no timer), `clear(accountId)`, `onIssued(listener)`. `app.ts` registers the console listener (`app.log.warn`: `password reset code for <email>: ABCDE-FGHJK (valid until HH:MM, shown only here)`). `buildApp()` exposes the sink to the host (the host already imports it).

### 3.3 Routes (`api/auth-reset.ts`, registered after `registerAuth`; public; `no-store` through the `/api/auth` prefix)

| Route | Body (strict, zod) | Answer |
|---|---|---|
| `POST /api/auth/reset-request` | `{ email }` (at most 254) | `202` `{ requested: true }`, always; `429 auth.rate_limited` |
| `POST /api/auth/reset` | `{ email, code, newPassword }` (`code` at most 32; `newPassword` 12 to 256) | `200` `{ reset: true }`; `401 auth.reset_invalid`; `422 account.invalid` (field `newPassword`); `429 auth.rate_limited` |

New error: `authResetInvalid: { code: "auth.reset_invalid", status: 401, message: "That code is not valid or has expired." }` in `constants/errors.ts`. Routes parse, make one service call and return the envelope (`01` 4.3). `03` 7.12 and section 8 gain both routes and the code.

### 3.4 The Electron side (`src/backend/src/app`)

- `reset-codes.ts` (pure, testable in plain node): `resetDialogText(pending, now)` builds the message: a title `Password reset codes`, one line per pending code `<email>  <CODE>  until HH:MM`, and, when none, `No reset has been requested. Choose "Forgot password?" on the sign-in page.`; `issuedNotice(entry)` for the auto-popup.
- `reset-dialog.ts`: shows the text with `dialog.showMessageBox` (an informational box, buttons `Close`; not modal to the page, so the window stays usable); `main.ts` subscribes it to `sink.onIssued` (a pop-up at most once per account per 60 s, since the service itself cools down).
- `tray-menu.ts` gains the action `resetCodes` with the label `Reset a password...` between `Open` and `Quit` (the tray test that pins "exactly these two entries" is updated to three); `tray.ts` runs it; when the host did not start the backend (it attached), the box says `Reset codes are shown in the console of the backend this window attached to.`.
- No IPC, no preload change, no new renderer capability: the dialog is main-process only.

### 3.5 Tests (written AND run by B3, `src/backend/test`; temporary `DATA_DIR`s, a hand-moved clock, a seeded `random`)

`reset.test.ts`: request answers `202` and identical bodies for a known, an unknown and a disabled email; a known email creates one row and publishes to the sink and the audit (`auth.reset_requested`, no code in `detail`); a second request inside 60 s issues nothing; after 60 s it replaces the row; reset with the right code sets the password (the old one fails, the new one signs in), revokes every refresh token and the access token (`ver`), clears a lockout, deletes the row, audits `auth.reset_completed`; a used code fails; an expired code fails (clock +15 min); five wrong tries burn the code (the sixth with the right code fails); a right code with an 11-character password is `422` and the code still works; the code is case-insensitive and ignores a dash and spaces; unknown email / disabled / wrong / expired / burned all answer the same `401` body; the rate limiter returns `429`; no response body ever contains the code; the stored hash is not the code; `no-store`; the database holds no plaintext (a scan of the file). `reset-migration.test.ts`: `019` applies on a `018` database, `user_version` at least 19, the cascade deletes the row. `reset-sink.test.ts`: publish, prune on access, clear, listener. `tray-menu.test.ts` (updated): three entries in order. `reset-codes.test.ts`: the dialog text for none, one and two pending codes, the attach message.

## 4. The admin gate (worker R; `src/admin`)

### 4.1 Views and states (`lib/reset-state.ts`, pure; `lib/gate-state.ts` untouched)

Views in the same wall (`SignInPage`): `signin` (today) -> `reset-email` -> `reset-code` -> `signin`. Events: `forgot`, `back`, `submit`, `answer(result)`. Phases per view: `idle`, `submitting`, `refused` (with a sentence and its row), `unreachable`.

| View | Rows (top to bottom) | Verb | What shows |
|---|---|---|---|
| `signin` | Email, Password | `Sign in` | a ghost `InlineLink` **`Forgot password?`** under the Password row, right-aligned; pressing it opens `reset-email` with the typed email carried over |
| `reset-email` | Email | primary `Send a code` (large, full width), ghost `Back to sign in` | heading `Reset your password`; disabled with `Enter your email.` when empty |
| `reset-code` | Email (read-only), Code, New password | primary `Reset password`, ghost `Back to sign in` | the `GateNotice` card `If that email has an account, a code was shown on the machine running the admin backend.` (the same whatever the answer was); Code and New password are the editable rows; an info glyph on Code carries where to find it (the backend's own window, the tray icon's `Reset a password...`, or its console) |

Copy (`constants/reset-copy.ts`): headings, the verbs above, the refusal sentences - `That code is not valid or has expired.` under Code (`auth.reset_invalid`), `Password must be at least 12 characters.` under New password (client check first, then the backend's `422`), `Too many attempts; wait a minute.` for `rate_limited`, `The admin backend cannot be reached.` for `unreachable` - and the success notice on the sign-in view: **`Password reset. Sign in with the new password.`** (the gate's `GateNotice`, title `Password reset`). `Sign in` verb reasons are unchanged. The password fields use `autoComplete="new-password"` on the reset view. Email is focused on `reset-email`; Code is focused on `reset-code`; after a refusal focus returns to the refused row; the code field is cleared on a refusal and kept on `unreachable`; Escape does nothing (a gate has no cancel).
Layout, brand column and the full-window wall are unchanged; the reset views scroll in the auth column like the sign-in form. No timer.

### 4.2 AuthPort additions (`types/auth.ts`, `services/auth-port.ts`, `services/session-api.ts`, additive; owned by R)

```ts
type ResetRefusal = "invalid" | "weak" | "rate_limited" | "unreachable";
type ResetRequestResult = { ok: true } | { ok: false; refusal: "rate_limited" | "unreachable" };
type ResetResult = { ok: true } | { ok: false; refusal: ResetRefusal };
interface AuthPort {
  /* existing signIn, signOut */
  requestReset(email: string): Promise<ResetRequestResult>;                           // POST /api/auth/reset-request, public layer
  resetPassword(email: string, code: string, newPassword: string): Promise<ResetResult>; // POST /api/auth/reset, public layer
}
```
Both never reject. `session-api.ts` gains `resetRequest` and `reset` on its public (token-free) layer; `lib/auth-errors.ts` gains `resetRefusalFor(error)` (`auth.reset_invalid` -> `invalid`, `account.invalid` -> `weak`, `auth.rate_limited`, transport/5xx -> `unreachable`). `constants/api-sentences.ts` gains `auth.reset_invalid` (the coordinator adds it at merge if R is not allowed to; R is named owner of that one line).
`hooks/useResetRequest.ts` and `hooks/useResetPassword.ts` await the port and hand the answer to the pure state; the store holds no promise; a double submit is ignored while `submitting`.

### 4.3 Files (R)

Create: `lib/reset-state.ts`, `constants/reset-copy.ts`, `components/session/ResetEmailForm.tsx`, `ResetCodeForm.tsx`, `ForgotLink.tsx`, `hooks/useResetRequest.ts`, `useResetPassword.ts`. Update: `components/session/SignInForm.tsx` (the link), `pages/SignInPage.tsx` (the view switch), `types/auth.ts`, `services/auth-port.ts`, `services/session-api.ts`, `lib/auth-errors.ts`, `constants/sign-in-copy.ts` (the notice), `constants/api-sentences.ts`.

### 4.4 Tests (written AND run by R)

`reset-state.test.ts` (every transition: forgot, back, submit twice, answers for each refusal, the carried email); `reset-copy.test.ts` (every sentence word for word); `reset-auth-port.test.ts` (the two calls with the fake backend: bodies, public layer carries no `Authorization`, each refusal mapping, a rejected fetch is `unreachable`, a `422` is `weak`); `reset-markup.test.ts` (the `Forgot password?` link on the sign-in view; the email view's one row and verbs; the code view's rows in order, the read-only email, `new-password`, the info glyph, the notice card, the refusal under the refused row with `role="alert"`; no placeholder; no `aria-disabled`; the primary is the only filled button); `gate-cover.test.ts` stays green; `no-network-storage.test.ts` stays green.

## 5. Failure modes

- **A lost code:** it is not recoverable (hashed); the person asks again after 60 s; the tray lists the pending ones while the process lives.
- **Headless or attached backend:** only the console shows the code; the gate's notice already says "the machine running the admin backend".
- **Clock changes:** expiry is compared with the service's `now()`; a clock set back extends a code only within its original 15 minutes of stored time.
- **A wrong code five times** burns it: the person must request another, which is held to the 60-second cooldown.
- **Two windows** asking at once: one active code per account, the later request replaces the earlier (the earlier code then fails as invalid).
- **A restart** forgets pending plaintext codes (the hashes remain until they expire, unusable by anyone who has not seen the code).
- **Locked account:** a successful reset clears the lockout; a reset request on a locked account still issues a code.
- **Disabled account:** no code is issued and the answer is unchanged; the owner re-enables it from another account.
- **The only account is lost** (no password, no code access): there is no remote recovery by design; the machine's owner can read the code locally, or set a bootstrap account in a fresh `DATA_DIR`.

## 6. Acceptance (coordinator; temporary backend of `39` section 9, port 8397)

1. B3 on the temporary backend over HTTP (curl-style, no browser): `reset-request` for the known test owner, an unknown email and a disabled account returns the **same status and body**; the temp backend's stdout log (the coordinator reads that file, not the owner's) holds exactly one code line, for the known account; `reset` with it and a new password answers `200`; the old password is refused, the new one signs in; the old refresh token answers `auth.refresh_invalid`; the same code again is `401`; five wrong codes burn a fresh code; an eleventh request in a minute is `429`; a 60-second repeat issues no second line; the database holds no plaintext code; no response body ever shows the code.
2. R in Chrome at 1600 x 1000 and 900 x 640, dark and light, on the same backend: the gate's `Forgot password?` link opens the email view with the typed email carried over; `Send a code` shows the code view and the notice (identical for an unknown email); a wrong code shows its sentence under Code, password field kept; the right code with a short password shows the length sentence under New password and the code still works; the right code resets and returns to the sign-in view with `Password reset. Sign in with the new password.`; the new password signs in; focus order and the full-window wall are unchanged; console clean; every request is public (no `Authorization`) and none writes browser storage.
3. The Electron action: the tray item `Reset a password...` and the dialog text are covered by the pure tests; on the owner's real stack the coordinator looks (read-only) at the tray item opening the box with **no pending codes** - which reads nothing and changes nothing - and **never requests a reset on the owner's backend** (it would pop a real code and an audit row on their data).
4. Cleanup as `39` section 9: the temp backend stopped by PID, its folder deleted, the owner's data untouched.

## 7. Open decisions for the owner

| # | Decision | Default taken |
|---|---|---|
| 1 | Email delivery of the reset code (needs an SMTP or provider key in the backend's environment) | not now; the local code is the design; email is a later option |
| 2 | A command-line reset (`--reset-password <email>`) for a headless backend with no console access | not planned |
| 3 | The code is 10 characters, valid 15 minutes, five tries | as stated |

## 8. Doc against code: differences found (2026-10-17)

| # | Doc says | Code does |
|---|---|---|
| 1 | `34` 3 and 5: no forgot-password, no text link on the gate | superseded (owner, 2026-10-17): a `Forgot password?` link and a reset view |
| 2 | `03` 7.12 lists five auth routes | gains `reset-request` and `reset`; section 8 gains `auth.reset_invalid` |
| 3 | `tray-menu.ts`'s model and its test pin "exactly these two entries" | three, with `Reset a password...` |
| 4 | `01` 4.4: no timers in any program | the code's expiry is a stored time compared on use and the sink prunes on access; nothing is armed |
| 5 | `29` 6.1: the sign-in failures are three (`invalid_credentials`, `rate_limited`, `locked`) | the reset views add `auth.reset_invalid` and a `weak` password refusal |
