# 63 - Account-centric persistence plan

**Status: plan, written before the code (coordinator, branch `dev`).** Owner, 2026-10-20: "unregistered users
can browse the app/channels with no history or anything persisted. registered users get history and collections
and cloud persistence. so we need a login button next to the theatre button, that brings up the auth gate. and
we need to hide the collections feature and history from non registered users. we need to test end to end
persistence in the browser and in the cloud and registered vs unregistered flow." This supersedes the signed-out
homes of `docs/61` and the offline escape of `docs/62`: persistence is a registered feature, full stop.

## 1. The model

Corrected (owner, 2026-10-20): unregistered users were never denied storage - they keep their **device's local
persistence** (the desktop's fileserver rows, the browser's local stores of `docs/61`) for layout and settings.
What they do not get is the **cloud** and the **history and collections features**: no watch tracking at all,
no history or collections surfaces, favorites disabled with their reason.

| | Unregistered | Registered |
|---|---|---|
| Browsing (catalog, channels, player, live) | full | full |
| Layout, settings, last channel | the device: the fileserver's rows on the desktop, the local stores in a browser | the account for settings; the shell stays on the device (`62` § 3.6) |
| Watch history | **not tracked** - no writes anywhere, no Continue/History UI | the account (cloud), every runtime |
| Collections, favorites | hidden / disabled with reason | the account |

First sign-in needs no merge for history: an unregistered device has none to bring (the YouTube answer -
nothing accumulates signed out). Settings keep D8's rule: the account wins once, the local copy becomes the
mirror. The shell never moves to the account; `docs/62` § 3.6's rows stand.

## 2. What exists today (verified, post-62)

- The resolver (`src/frontend/src/services/persistence.ts`) routes: signed in → the account for settings,
  favorites and collections; signed out → desktop fileserver / browser local stores; watch by runtime alone.
  The gate is a wall in `components/chrome/App.tsx` (`!signedIn && !offline`), with a desktop-only offline
  escape; Settings has a Session section; the boot restore runs silently.
- The backend account API (`/api/account/*`) holds settings, favorites and collections - **no watch table and
  no shell home**.
- The titlebar's Theatre control sits in `components/chrome/Titlebar.tsx`; the Library owns ContinueCard/
  ContinueStrip, HistoryStrip, CollectionsSection/CollectionsFooter and the rail entries that open them.

## 3. Design

### 3.1 The gate becomes opt-in

The wall goes. `App.tsx` renders the three surfaces whenever `!signedIn`, and the titlebar gains a control
beside Theatre: signed out, "Sign in" opens the gate as an overlay dialog (the existing SignInGate content,
dialog-mounted, Esc/backdrop closes it); signed in, the control shows the username and opens the same dialog
with sign-out. The boot restore stays silent as today; a 401 under a live session drops to unregistered with
the drawer row it already speaks. The offline escape is retired (browsing signed-out IS the default state now);
`offersOfflineEscape` and `continueOffline` leave with their tests. Signed out, the watch domain answers
`none`: the Player guards its writes on the session, the Library issues no continue/history queries and no
decoration, and the desktop's fileserver watch routes are simply never called.

### 3.2 Registered history: the account owns it

Migration `032-user-watch.sql` (next after `031`): `user_watch` - `id TEXT PRIMARY KEY`, `account_id FK
admin_accounts ON DELETE CASCADE`, `item_kind`, `item_id`, `season`, `episode`, `position_ms`, `duration_ms`,
`state` (`watching` | `watched`), `updated_at`, `playback_id`, `seq`, with the fileserver's unique-per-item-
episode identity (a UNIQUE index on `(account_id, item_kind, item_id, COALESCE(season,0), COALESCE(episode,0))`)
and the `idx` on updated_at. Routes `PUT/DELETE /api/account/watch(/:watchId)`, `DELETE /api/account/watch`,
`GET /api/account/watch` (the account's entries, newest first) - behind `anySignedIn`, the same envelope and
refusal shapes the fileserver's watch routes answer, with the shared semantics applied at write time (threshold,
clamp, sticky - `src/shared/watch`, so there is one implementation on both servers). No shell table: the shell
stays on the device (`62` § 3.6), so `docs/63` adds only the watch home.

**The fileserver is the one that decides where a watch write lands** (owner, 2026-10-20): the frontend keeps
its single contract - every write, removal and clear goes to the fileserver's `/api/watch`, as it always has -
and the fileserver routes by where the session runs. A request that carries the Electron runtime marker (the
page sends `x-giga-runtime: electron` from `pocHost`; the desktop window is the only place it exists) writes
to the fileserver's own `node:sqlite` exactly as today. Any other request is a browser: it must carry the
account's bearer, and the fileserver passes the write through to the backend's `/api/account/watch` with that
authorization - the cloud row, per account. A browser write with no account is refused `401` ("sign in to keep
history"); the signed-out client guards make it moot. Reads follow the same split: the desktop keeps today's
server-computed continue/history and decoration, while a signed-in browser reads its entries from
`GET /api/account/watch` through the existing `/api/account` pass and computes continue, history and the row
decoration client-side on `src/shared/watch` - the machinery `docs/61` wave 2 built for the local store, with
the account as the source instead of IndexedDB.

### 3.3 The resolver's new matrix

| Domain | Desktop (Electron) | Browser signed in | Browser signed out |
|---|---|---|---|
| watch writes | the fileserver's `node:sqlite` (today) | the fileserver passes the write to the account (`/api/account/watch`) | not tracked - the client never calls |
| watch reads (continue, history, marks) | the fileserver computes (today) | the client computes from the account's entries (`src/shared/watch`) | none - the surfaces are hidden |
| collections, favorites | the account | the account | hidden / disabled (`62` § 3.6) |
| settings | the account | the account | the device (`61`) |
| shell | the device | the device | the device (`62` § 3.6) |

`local-watch.ts` and its IndexedDB store leave the program: the watch domain's homes are the desktop's local
store and the account, never a third one. The rule checker's browser-storage allow-list drops
`local-watch.ts` with it. `local-state.ts` stays exactly as `docs/61` built it: the browser's signed-out
shell/settings/last-channel stores, and the signed-in settings mirror (D8). Signed out, the Library issues no
continue/history queries and the Player records nothing.

### 3.4 Hiding, not disabling, for unregistered

Collections: the rail entry, CollectionsSection, CollectionsFooter and the card-menu's collection actions are
unrendered when signed out. History: HistoryStrip, the Continue strip and cards, and the Library's history
queries are unrendered/unissued when signed out. Favorites: the card-menu and detail heart stay rendered but
visibly disabled with their reason (docs/06's rule) - hiding a per-item control reads as a broken card. The
rail keeps Library and Live exactly as they were.

### 3.5 The login control

Beside Theatre in the titlebar: signed out, a "Sign in" button (the shared-ui button, the gate's copy);
signed in, the username as a button opening the same dialog with the Session section's sign-out. The dialog is
the gate's existing forms (sign-in, forgot-password through `/api/auth/*`), closed by Esc or backdrop; focus
returns to the titlebar control on close.

## 4. Change list

| Program | Change |
|---|---|
| Backend | Migration `032` (user_watch); `store/user-watch-repository.ts`; `/api/account/watch*` routes; tests |
| Fileserver | `/api/watch` (and the removal/clear routes) route by the session's runtime: electron → local (today), browser → the caller's bearer required and the call passed to `/api/account/watch`; tests |
| Frontend | The `x-giga-runtime` marker on the watch calls; browser signed-in reads computed from the account's entries (the `61` wave 2 joins, account-sourced) and `local-watch.ts`'s removal with the rule-checker prune; the titlebar control + the dialog gate; App.tsx without the wall; the hide rules (§ 3.4); the Player's signed-out write guard; tests |
| Docs | `docs/03` (the watch route's fork), `docs/02` (session-gated surfaces), `docs/04` (what survives, § 1's table), `docs/06` (the titlebar control, the hidden sections), `docs/61`/`docs/62` supersession notes |

## 5. Tests

- Backend: the migration (identity uniqueness per account, cascades); watch write/threshold/sticky/episode
  identity per account, remove/clear/list ordering, cross-account isolation; every route 401 signed out.
- Fileserver: an electron-marked write lands in the local store (today's answer); a browser write with a
  bearer lands in the account (forwarded, the account's answer returned); a browser write with no bearer is
  refused; the flag-off desktop default is byte-identical to today.
- Frontend: the matrix cells of § 3.3; signed out, the watch domain emits no calls (fetch throws if reached)
  and renders no collections/history/continue; the dialog gate opens/closes/returns focus; signed-in browser
  reads decorate from the account's entries; the signed-out local shell/settings stores still work
  (`docs/61`'s behaviour unchanged); the signed-in settings mirror still lands locally.

## 6. End-to-end (the owner's acceptance, coordinator on the real stack)

1. **Browser, unregistered**: browse channels and a title, move layout, reload - the layout and theme came
   back (the device's local stores, `docs/61`), and there is no history, no Continue, no collections anywhere;
   the DevTools storage shows no watch rows and the server gained none.
2. **Browser, registered**: sign in through the titlebar control, play to a position, build a collection, change
   theme - reload: signed in (cookie restore), history and Continue back, collection back, theme back, all from
   the account. A second browser profile signing into the same account sees the same history and collections
   (the cloud is the home, not the device).
3. **Registered vs unregistered side by side**: the unregistered profile shows no history/collections surfaces
   at all; signing in makes them appear without a reload.
4. **Desktop**: registered signs in and sees the same account data; signs out and keeps browsing with local
   layout/settings only, and no watch tracking.
5. The gate's forgot-password flow through `/api/auth/*`, and `writes.closed` remains on the public deployment
   until accounts are the only writers.
