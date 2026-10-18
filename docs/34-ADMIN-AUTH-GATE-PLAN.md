# 34 - Admin auth gate plan (Wave 2a)

> **Amended 2026-10-18 (owner):** there is no sign-in rate limit and no lockout. The gate's `locked` and `rate_limited`
> refusal kinds and their sentences are removed; a wrong pair is always `invalid`, an unreachable backend `unreachable`.

> **Done (`487b934`, `a19845e`).** The seam of section 5 is now real: the foundation (`07b60d7`) replaced the fixture port with `services/auth-port.ts` and `services/auth.ts` over the request
> layer, put the tokens in the session slice (`adoptTokens`, `endSession`), and deleted `fixtures/auth-port.ts` and the `?signedin=0` switch; the gate maps refusals with `lib/auth-errors.ts`
> (any other 4xx is `invalid`, a 5xx or unreadable answer `unreachable`). `35` adds the actor's account id. Sections 3, 4 and 6 to 9 describe the gate as built; the demo credentials of 5 are gone.

**Status: plan, written before the code (branch `admin/auth-gate`, from `family-port`).** Owner: "we forgot the auth
gate; roll it into the next wave (2a); use the same style as the Giga Images gate; we don't need the full OAuth, just the
login gate and the login form." Wave 2 built a sign-in page (`28` section 7.1, Appendix A row 73). This wave replaces its
look with the Giga Images gate's, adds the states a gate needs, and puts the sign-in behind a port so Wave 7 (`29`
section 6) swaps the fixture for the backend without touching a component.

## 1. What exists (verified in source)

- `components/session/SignInForm.tsx` (a `Group` titled `Sign in`, Username and Password rows, one primary `Sign in`),
  `pages/SignInPage.tsx` (the form in a 480px column inside `Workspace`), `store/session-slice.ts` (`signedIn`,
  `actor`, `signIn(username)`, `signOut()`), `fixtures/session.ts` (`actorFor`), `constants/sign-in-copy.ts`,
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
| `components/gate/LoginGate.tsx` | the **two-column wall**: a brand column left, the auth column centred in the rest, `w-[min(320px,86vw)]` flex column with `gap-3.5`; the heading (`Sign in`, mono 15px semibold) and the faint 12px note under it; the danger sentence rendered **above** a form that still works; no Escape handler (a gate has no cancel); "an unreachable service is a sentence in place, never a screen" (its `UNREACHABLE` rule) | the `data-leaving` fade and `GATE_BEAT_MS` timers; the Tab trap (`useWallFocus`, replaced by an inert shell); the `waiting`, `signedIn` beat and `loading` views (section 4 lists what is matched: the cover and the drag strip are) |
| `components/gate/GateBrand.tsx` | the brand column: tile + two-line mono wordmark, a 22px mono headline, a 13px faint paragraph; `bg-panel`, `border-r border-hair`, `px-12`, width 44% (min 320, max 520) | the Images icon and copy; the 720px breakpoint (the admin shell holds 900px) |
| `components/gate/GateBlock.tsx` | the titled notice card (`rounded-card border bg-panel p-3`, icon + 13px title + 12px sentence), `plain` tone, for the session-ended notice | the `danger` tone: a refusal belongs under the Password row (`29` section 6.1) |
| `components/gate/GateButton.tsx` | the idea of **one control scale** on the gate: one large primary, full width | its own button recipe: the library `Button size="lg" full` is the family's button |
| `components/gate/EmailForm.tsx` | the phases `idle`, `submitting`, `invalid` and their order; inputs disabled while submitting; `autoComplete="current-password"`; the verb swaps to a working label while submitting; the form keeps its values on a refusal | sign-up, "Create an account instead", the `Back` button, the 8-200 hint, `needsVerification`, the OAuth `ProviderDoors` |
| `hooks/useLoginGate.ts` | the rule that a failure is a sentence over a gate that still works, and that a session ending elsewhere raises the gate again | OAuth, the account polling, `visibilitychange`/401 listeners (no timers or listeners in the admin), the beat |

Not in the reference, so not built: a show/hide password toggle, a footer (the wall has none). A `Forgot password?` link
and the reset views were added later (owner, 2026-10-17; `40`).
Provider doors, OAuth and sign-up are out by the owner's direction.

## 3. Design

**Layout.** The gate fills the whole window (section 4). Left: `GateBrand`, hidden under 720px
like the reference. Right: a scrolling area (`overflow-y-auto`) with
the form column centred by `m-auto`, 26rem wide, so a short window scrolls instead of clipping. Inside the column, top
to bottom: the notice card (only when a session ended), the heading `Sign in`, the form.

**The form.** `Form ariaLabel="Sign in"`; Username and Password as library `Row`s (label column from `labelColumn`, 120px:
the template's grammar; the reference's placeholders are banned in the admin); `Input type="text"` with
`autoComplete="username"`, `type="password"` with `autoComplete="current-password"`; `Actions` with one primary
`Button size="lg"`. Username is focused on mount (`autoFocus`). Enter in either field submits (a real `<form>`).

**`Sign in` verb reasons** (pure, `lib/sign-in-verb.ts`, priority order): submitting `Waiting for the answer.`; both
empty `Enter your username and password.`; username empty `Enter your username.`; password empty `Enter your password.`
Whitespace-only username counts as empty; the password is never trimmed. A reason makes the button natively `disabled`
inside the family tooltip (`Button reason`), exactly as Wave 2 drew it.

**States** (pure, `lib/gate-state.ts`, `nextGate(state, event)`): `idle` (optionally with a `notice`), `submitting`,
`refused`, `locked`, `unreachable`. Events: `submit`, `answer(result)`, `ended(sentence)`.

| State | Fields | Verb | What shows |
|---|---|---|---|
| idle | enabled | by the reasons above | nothing; with a `notice`, the `GateNotice` card above the heading |
| submitting | disabled | disabled, `Waiting for the answer.`, label `Signing in` with `animate-pulse-busy` (the library's in-flight look, as `SavedTick`/`RunningWork`; no rotation) | the previous error is gone |
| refused (wrong username or password) | enabled; password cleared, username kept; focus to Password | by the reasons (Password empty) | `The username or password is wrong.` under the Password row (`Row error`, `role="alert"`) and on the notice line (`say`, `warn`, area Session) |
| locked (`auth.locked`, `auth.rate_limited`) | as refused | as refused | `This account is locked for a while after failed sign-ins.` / `Too many sign-in attempts; wait a minute.` |
| unreachable | enabled; username and password kept; focus to Password | enabled (pressing it is the retry, as in the reference) | `The admin backend cannot be reached.` |
| session ended | (idle) | | `GateNotice`: title `Signed out`, sentence `Your session ended. Sign in again.` and the same on the notice line |

The sentences are `29` section 7's table, word for word; the brief's shorthand "Email or password is wrong." is that
table's `auth.invalid_credentials` row (now `The username or password is wrong.`). An unknown username and a wrong password answer the same sentence (`03` 7.12).
Locked and rate-limited show a sentence only: the client cannot know when the lock ends, so the verb stays enabled and
the server decides.

**Not built, on purpose:** show/hide password, remember me, sign-up, OAuth, any text link but `Forgot password?`
(`40`).

## 4. How the gate relates to the chrome (decision)

**Decision (amended 2026-10-17, owner: "why is it showing the title bar. This is not how Giga Images is."): the gate
owns the whole window.** The first version of this plan kept the titlebar and statusbar in place; that was wrong and is
withdrawn. **This supersedes the Wave 2 acceptance wording "`Sign out` returns to the sign-in page with the chrome in
place"** (`28`'s Wave 2 list, `26` 4.3, `29` 6.1): `Sign out` now returns to the full-window gate. Signed out the admin
shows no titlebar, no tab pill, no brand, no toggles, no Events drawer and no statusbar.

What the reference does (`LoginGate.tsx`, `GateBrand.tsx`, `GateBlock.tsx`, `Titlebar.tsx`) and what is matched:

| Reference behaviour | Here |
|---|---|
| The wall is `fixed inset-0 z-75 flex flex-col bg-bg`, covering the titlebar: "the one exception to the rule that overlays inset below the 40px bar" | matched: `pages/SignInPage.tsx` |
| A 40px `absolute inset-x-0 top-0 z-1 [-webkit-app-region:drag]` strip overlays the columns, so the window stays draggable and the brand column is not pushed down | matched |
| The native caption buttons are the OS's, drawn over the top-right (`titleBarOverlay`); the wall puts nothing there | matched: no control sits in the top 40px; `useCaptionOverlay` paints the strip with `--color-surface` and the full 40px signed out (the gate's right column runs under it), and back to the bar's panel colour signed in. In a browser there is no strip |
| `role="dialog" aria-modal="true"`, no Escape handler, not dismissible | matched |
| The app stays mounted behind and a capture-phase Tab trap (`useWallFocus`) keeps the keyboard in the wall | **not matched, replaced** (owner: the app behind must be inert): the shell wrapper is `inert` and `aria-hidden` while signed out and holds no titlebar, drawer, statusbar, overlay or page, so there is nothing to Tab into and no trap is needed |
| Focus moves in when the wall appears | matched: Username is `autoFocus`; after sign-out the wall mounts fresh, so focus lands there |
| The leaving beat: hold `GATE_BEAT_MS` (900ms), then fade over `--duration-page` through `data-leaving` | **not matched**: it needs two timers (`01` 4.4, `28` row 73). The wall is removed at once when the session starts |
| The `signedIn`, `waiting`, `loading` views, OAuth, polling | not built (owner: login gate and form only) |

The gate's right column is `bg-surface` so the caption strip and the form share one colour; the left column is `bg-panel`
as in the reference. Where the reference's reason applies (nothing of one account is left for the next), `signOut`
and `endSession` still reset the tab, workspaces, overlay and events.

## 5. The seam for Wave 7

```ts
// types/auth.ts
type RefusalKind = "invalid" | "locked" | "rate_limited" | "unreachable";
type AuthResult = { ok: true; session: AuthSession } | { ok: false; refusal: RefusalKind };
interface AuthSession { actor: SessionActor }       // Wave 7 widens it to the full Session of 29 section 5
interface AuthPort {
  signIn(username: string, password: string): Promise<AuthResult>;
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
  a second 401 or a failed refresh), `signOut()`. Wave 7 adds the tokens next to `actor` (the access token in memory only, the refresh token the backend's cookie, `26` D5; the gate waits behind a shimmer wall for the on-load restore) and
  `finishSignIn` stores them; the components read `signedIn`, `actor`, `gate` only and do not change.
- `hooks/useSignIn.ts` and `hooks/useSignOut.ts` are the only code that awaits the port; the store holds no promise.

## 6. Files

New: `types/auth.ts`, `lib/gate-state.ts`, `lib/sign-in-verb.ts`, `fixtures/auth-port.ts`, `services/auth.ts`,
`hooks/useSignIn.ts`, `hooks/useSignOut.ts`, `components/session/GateBrand.tsx`, `components/session/GateNotice.tsx`.
Changed: `components/session/SignInForm.tsx`, `pages/SignInPage.tsx`, `store/session-slice.ts`,
`components/settings/SessionSection.tsx`, `constants/sign-in-copy.ts`, `fixtures/session.ts` (comment only), and the
tests that used `signIn(username)`. No change under `src/shared/ui`: every piece the gate needs is in the library.

## 7. Tests (`node:test`, `src/admin/test`)

`gate-state.test.ts` (every transition, a double submit, a stale answer, `ended`), `sign-in-verb.test.ts` (the reasons
and their order), `auth-port.test.ts` (demo pair signs in, case-insensitive username, wrong password, locked, unreachable,
`signOut` resolves), `session-slice.test.ts` (signed out -> signed in -> signed out; a refusal keeps the user on the
gate with the sentence; `endSession` leaves a notice; a second `beginSignIn` while submitting changes nothing),
`gate-markup.test.ts` (string-rendered gate and form in each state: autocomplete attributes, `Sign in` reasons, disabled
fields while submitting, the sentence under Password with `role="alert"`, the notice card, no placeholder, the
full-window dialog with its drag strip, no OAuth/sign-up words; `Forgot password?` is the one link, `40`); `gate-cover.test.ts` (signed out: the gate and no
titlebar, tab pill, Events drawer or statusbar, and the shell wrapper `inert` and `aria-hidden`; signed in: the chrome
and no inert wrapper). `settings-markup.test.ts` and `events-paging.test.ts` are updated for the
new look and `finishSignIn`. `no-network-storage.test.ts` must still pass unchanged.

## 8. Failure modes

- A double submit (Enter twice) is refused by `nextGate` and by the hook; one request leaves.
- A port that rejects instead of answering is caught in the hook and treated as `unreachable`.
- An answer arriving when the gate is no longer submitting (a sign-out raced it) is dropped by `nextGate`.
- A short window: the auth column scrolls; the brand column hides under 720px.
- Password managers: `username` + `current-password` and a real `<form>` with a submit button.
- Error text stays until the next submit (the reference does the same); typing does not clear it.

## 9. The coordinator's real-stack checklist

1. `?signedin=0`: the gate covers the whole window, with no titlebar, tabs, toggles or statusbar; in Electron the
   caption buttons sit over the right column in its colour and the top 40px drags the window; both required sizes; dark and light; the brand column and the form column align with the Giga Images gate.
2. Username is focused on open. Tab order: Username, Password, Forgot password?, Sign in. Enter in either field submits.
3. Empty: `Sign in` disabled with `Enter your username and password.`; type a username only: `Enter your password.`
4. `ada@example.test` / `giga-demo` signs in and loads the pages; `Signed in.` on the notice line.
5. A wrong pair: `The username or password is wrong.` under Password and on the notice line; password cleared, username kept,
   focus in Password. `locked@example.test` and `offline@example.test` show their sentences.
6. Settings > Session > `Sign out` returns to the full-window gate (Tab never reaches the shell), empty fields, nothing of the account left.
7. Console clean; no request in the network tab from the admin this wave.
