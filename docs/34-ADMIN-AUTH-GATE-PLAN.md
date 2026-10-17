# 34 - Admin auth gate plan (Wave 2a)

**Status: plan, written before the code (branch `admin/auth-gate`, from `family-port`).** Owner: "we forgot the auth
gate; roll it into the next wave (2a); use the same style as the Giga Images gate; we don't need the full OAuth, just the
login gate and the login form." Wave 2 built a sign-in page (`28` section 7.1, Appendix A row 73). This wave replaces its
look with the Giga Images gate's, adds the states a gate needs, and puts the sign-in behind a port so Wave 7 (`29`
section 6) swaps the fixture for the backend without touching a component.

## 1. What exists (verified in source)

- `components/session/SignInForm.tsx` (a `Group` titled `Sign in`, Email and Password rows, one primary `Sign in`),
  `pages/SignInPage.tsx` (the form in a 480px column inside `Workspace`), `store/session-slice.ts` (`signedIn`,
  `actor`, `signIn(email)`, `signOut()`), `fixtures/session.ts` (`actorFor`), `constants/sign-in-copy.ts`,
  `constants/fixture-switches.ts` (`?signedin=0`), `SessionSection` (Sign out).
- The fixture accepts any non-empty pair. There is no submitting state, no refusal, no locked state, no unreachable
  state, no session-ended notice, no focus rule. `AppShell` shows `SignInPage` while `signedIn` is false; the pages are
  not mounted, the tabs sleep with `Sign in first`, the Events drawer shows its shimmer lines.
- The library has `Form`, `Row` (with its `error` line, `role="alert"`), `Actions`, `Button` (`reason`, `size`, `full`),
  `Input`, `Brand`, `labelColumn`, `SHIMMER` and the `animate-pulse-busy` token.

## 2. The reference: the Giga Images gate (read, not run)

Read in `D:\Projects\giga-images\src\frontend\src`:

| File | What this plan takes | What it leaves |
|---|---|---|
| `components/gate/LoginGate.tsx` | the **two-column wall**: a brand column left, the auth column centred in the rest, `w-[min(320px,86vw)]` flex column with `gap-3.5`; the heading (`Sign in`, mono 15px semibold) and the faint 12px note under it; the danger sentence rendered **above** a form that still works; no Escape handler (a gate has no cancel); "an unreachable service is a sentence in place, never a screen" (its `UNREACHABLE` rule) | the `fixed inset-0 z-75` cover over the titlebar and its `data-leaving` fade (section 4); the focus trap (`useWallFocus`); the `waiting`, `signedIn` beat and `loading` views; the drag strip; the timers (`GATE_BEAT_MS`) |
| `components/gate/GateBrand.tsx` | the brand column: tile + two-line mono wordmark, a 22px mono headline, a 13px faint paragraph; `bg-panel`, `border-r border-hair`, `px-12`, width 44% (min 320, max 520) | the Images icon and copy; the 720px breakpoint (the admin shell holds 900px) |
| `components/gate/GateBlock.tsx` | the titled notice card (`rounded-card border bg-panel p-3`, icon + 13px title + 12px sentence), `plain` tone, for the session-ended notice | the `danger` tone: a refusal belongs under the Password row (`29` section 6.1) |
| `components/gate/GateButton.tsx` | the idea of **one control scale** on the gate: one large primary, full width | its own button recipe: the library `Button size="lg" full` is the family's button |
| `components/gate/EmailForm.tsx` | the phases `idle`, `submitting`, `invalid` and their order; inputs disabled while submitting; `autoComplete="current-password"`; the verb swaps to a working label while submitting; the form keeps its values on a refusal | sign-up, "Create an account instead", the `Back` button, the 8-200 hint, `needsVerification`, the OAuth `ProviderDoors` |
| `hooks/useLoginGate.ts` | the rule that a failure is a sentence over a gate that still works, and that a session ending elsewhere raises the gate again | OAuth, the account polling, `visibilitychange`/401 listeners (no timers or listeners in the admin), the beat |

Not in the reference, so not built: a show/hide password toggle, a "forgot password" link, a footer (the wall has none).
Provider doors, OAuth and sign-up are out by the owner's direction.

## 3. Design

**Layout.** The gate fills the page area between the titlebar and the statusbar. Left: `GateBrand`, hidden under 720px
like the reference (the shell's minimum is 900px, so it normally shows). Right: a scrolling area (`overflow-y-auto`) with
the form column centred by `m-auto`, 26rem wide, so a short window scrolls instead of clipping. Inside the column, top
to bottom: the notice card (only when a session ended), the heading `Sign in`, the form.

**The form.** `Form ariaLabel="Sign in"`; Email and Password as library `Row`s (label column from `labelColumn`, 120px:
the template's grammar; the reference's placeholders are banned in the admin); `Input type="email"` with
`autoComplete="username"`, `type="password"` with `autoComplete="current-password"`; `Actions` with one primary
`Button size="lg"`. Email is focused on mount (`autoFocus`). Enter in either field submits (a real `<form>`).

**`Sign in` verb reasons** (pure, `lib/sign-in-verb.ts`, priority order): submitting `Waiting for the answer.`; both
empty `Enter your email and password.`; email empty `Enter your email.`; password empty `Enter your password.`
Whitespace-only email counts as empty; the password is never trimmed. A reason makes the button natively `disabled`
inside the family tooltip (`Button reason`), exactly as Wave 2 drew it.

**States** (pure, `lib/gate-state.ts`, `nextGate(state, event)`): `idle` (optionally with a `notice`), `submitting`,
`refused`, `locked`, `unreachable`. Events: `submit`, `answer(result)`, `ended(sentence)`.

| State | Fields | Verb | What shows |
|---|---|---|---|
| idle | enabled | by the reasons above | nothing; with a `notice`, the `GateNotice` card above the heading |
| submitting | disabled | disabled, `Waiting for the answer.`, label `Signing in` with `animate-pulse-busy` (the library's in-flight look, as `SavedTick`/`RunningWork`; no rotation) | the previous error is gone |
| refused (wrong email or password) | enabled; password cleared, email kept; focus to Password | by the reasons (Password empty) | `The email or password is wrong.` under the Password row (`Row error`, `role="alert"`) and on the notice line (`say`, `warn`, area Session) |
| locked (`auth.locked`, `auth.rate_limited`) | as refused | as refused | `This account is locked for a while after failed sign-ins.` / `Too many sign-in attempts; wait a minute.` |
| unreachable | enabled; email and password kept; focus to Password | enabled (pressing it is the retry, as in the reference) | `The admin backend cannot be reached.` |
| session ended | (idle) | | `GateNotice`: title `Signed out`, sentence `Your session ended. Sign in again.` and the same on the notice line |

The sentences are `29` section 7's table, word for word; the brief's shorthand "Email or password is wrong." is that
table's `auth.invalid_credentials` row. An unknown email and a wrong password answer the same sentence (`03` 7.12).
Locked and rate-limited show a sentence only: the client cannot know when the lock ends, so the verb stays enabled and
the server decides.

**Not built, on purpose:** show/hide password, remember me, forgot password, sign-up, OAuth, any text link.

## 4. How the gate relates to the chrome (decision)

The reference covers its own titlebar (`fixed inset-0`), because its titlebar and rails are lit furniture of an
account and showing them over a wall "shows an account's furniture to someone with no account". The admin does not have
that problem: signed out, its pages are not mounted at all, the tabs sleep with `Sign in first`, the Events drawer shows
shimmer lines, Settings shows dashes. And the owner's Wave 2 acceptance item says `Sign out` "returns to the sign-in
page with the chrome in place" (`28`'s Wave 2 acceptance list; `26` 4.3; `29` 6.1). So **the gate sits in the page area and the
titlebar and statusbar stay**; it is the reference's wall minus the cover. Consequences: no focus trap and no
`aria-modal` (the chrome remains reachable and Settings opens signed out), no drag strip, no fade-out beat (a swap, no
timer; `28` row 73 already ruled the beat unused). Where the reference's reasons do apply (nothing of one account is
left on screen for the next) the existing `signOut` already holds: pages unmounted, tab and workspaces reset, events
cleared. The gate is a `role="region"` labelled `Sign in`.

## 5. The seam for Wave 7

```ts
// types/auth.ts
type RefusalKind = "invalid" | "locked" | "rate_limited" | "unreachable";
type AuthResult = { ok: true; session: AuthSession } | { ok: false; refusal: RefusalKind };
interface AuthSession { actor: SessionActor }       // Wave 7 widens it to the full Session of 29 section 5
interface AuthPort {
  signIn(email: string, password: string): Promise<AuthResult>;
  signOut(): Promise<void>;                          // never rejects; the session is cleared whatever the answer is
  // Wave 7 adds: refresh(): Promise<AuthResult>, used only by services/api.ts (29 section 6.2)
}
```

- `fixtures/auth-port.ts` implements it with promises that resolve at once (no timer): the demo pair
  `ada@example.test` / `giga-demo` signs in; `locked@example.test` (any password) answers `locked`;
  `offline@example.test` answers `unreachable`; anything else answers `invalid`. The pair is documented in the file.
- `services/auth.ts` exports the one `authPort` the app uses (today the fixture). **Wave 7 replaces this file and deletes
  the fixture**: `signIn` becomes `POST /api/auth/login`, mapping `auth.invalid_credentials`, `auth.locked`,
  `auth.rate_limited` and `backend.unreachable` to the four kinds; `signOut` becomes `POST /api/auth/logout`.
- **The store contract Wave 7 keeps** (`SessionSlice`): `signedIn: boolean`, `actor: SessionActor | null`,
  `gate: GateState`, `beginSignIn()`, `finishSignIn(result)`, `endSession(sentence)` (what the request layer calls on
  a second 401 or a failed refresh), `signOut()`. Wave 7 adds the tokens next to `actor` (in memory only, `26` D5) and
  `finishSignIn` stores them; the components read `signedIn`, `actor`, `gate` only and do not change.
- `hooks/useSignIn.ts` and `hooks/useSignOut.ts` are the only code that awaits the port; the store holds no promise.

## 6. Files

New: `types/auth.ts`, `lib/gate-state.ts`, `lib/sign-in-verb.ts`, `fixtures/auth-port.ts`, `services/auth.ts`,
`hooks/useSignIn.ts`, `hooks/useSignOut.ts`, `components/session/GateBrand.tsx`, `components/session/GateNotice.tsx`.
Changed: `components/session/SignInForm.tsx`, `pages/SignInPage.tsx`, `store/session-slice.ts`,
`components/settings/SessionSection.tsx`, `constants/sign-in-copy.ts`, `fixtures/session.ts` (comment only), and the
tests that used `signIn(email)`. No change under `src/shared/ui`: every piece the gate needs is in the library.

## 7. Tests (`node:test`, `src/admin/test`)

`gate-state.test.ts` (every transition, a double submit, a stale answer, `ended`), `sign-in-verb.test.ts` (the reasons
and their order), `auth-port.test.ts` (demo pair signs in, case-insensitive email, wrong password, locked, unreachable,
`signOut` resolves), `session-slice.test.ts` (signed out -> signed in -> signed out; a refusal keeps the user on the
gate with the sentence; `endSession` leaves a notice; a second `beginSignIn` while submitting changes nothing),
`gate-markup.test.ts` (string-rendered gate and form in each state: autocomplete attributes, `Sign in` reasons, disabled
fields while submitting, the sentence under Password with `role="alert"`, the notice card, no placeholder, no
`aria-modal`, no OAuth/forgot/sign-up words). `settings-markup.test.ts` and `events-paging.test.ts` are updated for the
new look and `finishSignIn`. `no-network-storage.test.ts` must still pass unchanged.

## 8. Failure modes

- A double submit (Enter twice) is refused by `nextGate` and by the hook; one request leaves.
- A port that rejects instead of answering is caught in the hook and treated as `unreachable`.
- An answer arriving when the gate is no longer submitting (a sign-out raced it) is dropped by `nextGate`.
- A short window: the auth column scrolls; the brand column hides under 720px.
- Password managers: `username` + `current-password` and a real `<form>` with a submit button.
- Error text stays until the next submit (the reference does the same); typing does not clear it.

## 9. The coordinator's real-stack checklist

1. `?signedin=0`: the gate shows between the titlebar and the statusbar; tabs asleep with `Sign in first`; Events drawer
   shimmer; both required sizes; dark and light; the brand column and the form column align with the Giga Images gate.
2. Email is focused on open. Tab order: Email, Password, Sign in. Enter in either field submits.
3. Empty: `Sign in` disabled with `Enter your email and password.`; type an email only: `Enter your password.`
4. `ada@example.test` / `giga-demo` signs in and loads the pages; `Signed in.` on the notice line.
5. A wrong pair: `The email or password is wrong.` under Password and on the notice line; password cleared, email kept,
   focus in Password. `locked@example.test` and `offline@example.test` show their sentences.
6. Settings > Session > `Sign out` returns to the gate with the chrome in place, empty fields, nothing of the account left.
7. Console clean; no request in the network tab from the admin this wave.
