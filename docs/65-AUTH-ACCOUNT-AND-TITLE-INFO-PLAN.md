# 65 - Auth, account and title information plan

**Status: approved owner direction, 2026-10-20.** This plan supersedes `63`'s text login control and account dialog.

## 1. Account flow

- The titlebar account control is the shared ghost `IconButton` with the user icon only.
- Signed out, pressing it opens the family auth wall. The wall contains Sign in, Sign up and Reset password flows,
  built only from shared kit form controls. A visible Back control sits at the bottom-right corner and returns to Live.
- Signed in, pressing it opens the shared anchored popup with exactly `Account` and `Logout`.
- `Account` closes the popup before opening the shared `ChildWindow`; its profile form updates the username.
- `Logout` ends the session even if transport fails, closes account flows, clears account projections and only the
  browser-storage keys Giga Stream owns, then selects Live.
- Browser runtime omits the statusbar. Electron retains it.

## 2. Title information

The Library Info child window uses one catalog-product row: a correctly sized 2:3 image on the left and a single
scrolling details column on the right containing facts and the complete description. Loading uses the same shaped
two-column skeleton. Existing action strips, headings and missing-media behavior remain.

## 3. UI compliance

No feature-built modal, popup, focus trap, disabled-title wrapper or direct component I/O is added. Auth uses the
documented wall exception and shared form controls; the signed-in menu uses `PopupPanel`; profile and title info use
`ChildWindow`. Existing component-owned service calls/listeners and disabled-tooltip bypasses found by the audit are
moved to focused hooks or shared `reason` props without redesigning unrelated markup.

## 4. Waves

1. Direct-Turso account foundation from `64`: registration, reset, session and `PATCH /api/account/me`.
2. Frontend service/store foundation: registration/profile schemas, logout reset and owned local-state clearing.
3. Auth/chrome: icon control, family wall and flows, popup, Account child window, browser statusbar rule.
4. Title Info: catalog-product layout and matching skeleton.
5. Frontend `01` audit remediation: component I/O/listeners into hooks and shared disabled reasons.

## 5. Acceptance

At 1600x1000 and 900x640 in the real browser and Electron stack: every auth flow, refusal and busy state; Back;
signed-in popup; Account window; logout to Live; browser without statusbar and Electron with it; title information
for movie, series and local rows with long, short and absent descriptions/images; dark/light; keyboard/Escape/focus
return; clean console and valid wire answers. The gate and Windows package complete after each accepted code wave.
