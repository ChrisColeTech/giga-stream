# 54 - The security question moves to the account (plan v1)

**Status: v1 (2026-10-18).** Owner: "on accounts its not letting me select or answer a sny security quetions for te
reset"; "the security questions should be setup per ccount. not in the settings". Extends `40` (the password reset) and
`35` (the Accounts tab). Scope: the backend's question route, the admin's Accounts workspace and Settings. The gate's
reset flow is untouched. Landing (`07` 6.1): two waves - the backend route first
(`feat/account-question-backend`), the admin wave (`feat/account-question-admin`) cut after it lands.

## 1. Why (observed in the merged code)

- The security question exists FOR the gate's password reset (`40`), but the only place to set one is Settings ->
  Account: the signed-in account's OWN question, gated by its current password (`PUT /api/auth/me/security-question`,
  `SecurityQuestionSection`). The owner went to the Accounts tab expecting to set a selected account's question and
  found nothing there but the `Set` / `Not set` fact - hence "not letting me select or answer any security questions":
  the per-account setup does not exist. Not a defect; a design gap.
- An admin can already set any account's password outright (`AccountPasswordGroup` asks nothing of the target
  account), so an admin setting any account's question and answer adds no power the Accounts tab does not already
  have. The current-password proof exists because the me-route is self-service; a signed-in admin setting a selected
  account's question needs none.
- Every account appears in the Accounts list, including the actor's own, so nothing is lost: an admin sets their own
  question the same way as anyone else's.

## 2. Decisions

1. **The Accounts workspace gains a `Security question` group** for the selected account (the last group, after
   Password): the eight-question `Select`, an `Answer` row, its own `Save question` verb (not part of `Save details`;
   `Saving.` while it runs), and the group badge `Set` / `Not set` from the account's flag. The Details group's
   `Security question` fact row moves out (the badge carries it). `WORKSPACE_LABELS` gains `Answer`.
2. **The backend route becomes per account**: `PUT /api/admin-accounts/:id/security-question` with
   `{ question, answer }` - the actor is the signed-in admin, so no `currentPassword`; the answer is normalised and
   hashed exactly as today; a gone account answers the admin routes' standard not-found refusal; audit
   `account.security_question_set` (subject the account, detail the username). `PUT /api/auth/me/security-question`
   and its current-password service path are DELETED; the store's `setSecurityQuestion` is unchanged;
   `reset-start` and `reset` are untouched.
3. **Settings loses the Account page**: `SecurityQuestionSection`, `useSaveSecurityQuestion`, the `account` section id
   and its three labels (`Security question`, `Answer`, `Current password`) are deleted - Settings is three pages
   (Appearance, Session, About). The admin's own question is set in the Accounts workspace like anyone's.
4. **The reset flow is unchanged** - with one sentence: the gate's username -> question -> answer -> new password, the
   stable decoy for a question-less account, and the session-clearing on success (`40`). The one change is the
   always-shown no-question reason (`NO_QUESTION_REASON`, `constants/reset-copy.ts`), which says "under Settings >
   Account" today; it now says a signed-in admin sets the question in the Accounts workspace.
5. Refusals: `401` unsigned; `422 account.invalid` naming `question` or `answer`; the not-found code the
   admin-accounts routes already use for a missing account.

## 3. Changes from what is merged

- `src/backend`: the admin-accounts api file (the new route), `api/auth-security.ts` (the me-route deleted),
  `services/security-question-service.ts` (`set` becomes `setFor(accountId, question, answer, actor)`; the
  current-password branch goes), `types/security-question.ts` (the admin body schema), the audit action, the route
  tests.
- `src/admin`: `components/accounts/` (new `AccountQuestionGroup.tsx` and its save hook; `AccountWorkspace.tsx` renders
  it; `AccountDetailsGroup.tsx` loses the fact row), `services/accounts.ts` (+`saveQuestion`),
  `constants/account-copy.ts` (labels, tips, reasons), `components/settings/SecurityQuestionSection.tsx` and
  `hooks/useSaveSecurityQuestion.ts` deleted, `lib/security-question-form.ts` (moves to the accounts flow; the body
  carries no current password),   `constants/settings-sections.ts` (three sections, the labels),
  `components/overlays/SettingsWindow.tsx` (no account page), `constants/reset-copy.ts` (the reworded no-question
  reason), the schemas.
- `src/frontend`: nothing.

## 4. Tests

- Backend: the admin route sets and changes a question with no current password; `401` unsigned; `422` a bad
  question or answer naming its field; the gone account's refusal; the audit row written; the me-route answers `404
  route.not_found`; `reset-start`/`reset` unchanged (their tests untouched).
- Admin: the workspace group renders for a selected account (eight options, `Answer`, `Save question` with its
  reasons); a save updates the badge; Settings renders three pages and no question labels; the reworded no-question
  reason (`reset-copy.test.ts`); the deleted `security-question-section` suite is replaced by the accounts group's
  markup tests.
- The gate, then the real drive on the running stack with a THROWAWAY account the drive creates: set its question in
  the workspace, sign out, reset its password through the gate by answering the question, sign in with the new
  password, delete the account. The owner's own account is never touched.

## 5. Docs (coordinator)

`00` gains the row. A doc never describes unbuilt code (`07` section 2), so every amendment below lands with the wave,
naming exactly the places that planned the question as the account's own, in Settings:

- **`40`**: the Status's "a security question that each account sets for itself while signed in" becomes the
  per-account setup by a signed-in admin; section 2's route (`PUT /api/auth/me/security-question`), its
  current-password rule and its audit action `auth.security_question_set`; the route table's me-row; sections 2.5 and
  4.1's no-question reason (the new words); section 4.2 (the Settings Account page spec, deleted in favour of the
  Accounts workspace group); section 4.4's last sentence; and the stale "Success says `Security question saved.`"
  (that say was removed by `50`) - corrected in the same pass.
- **`35`**: decision 13 ("The question itself is set by the account's own owner in Settings > Account ... not in this
  Accounts workspace; no admin sets another account's question") is REVERSED by this plan - the decision note says so
  and points here; the workspace's Details facts list loses the Security question row to the new group's badge.
- **`26`**: the Accounts fields row (Last sign-in, Security question) and Settings' pages wherever `26` lists them.
- **`03`**: the route table's me-route row becomes the admin route; the 7.11/7.12 cross-references checked.
- **`28`**: line 23 already reads the Settings window as three pages (it predates `40`'s Account page); it goes
  correct again - nothing to fix.
- **`39`** (the B3 and R wave rows) and **`29`** line 76 are historical wave records and stay as written (the `51`
  precedent: history keeps its words).
