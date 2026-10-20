# 63 - Account-centric persistence plan

**Status: plan, written before the code (coordinator, branch `dev`).** Owner, 2026-10-20: "unregistered users
can browse the app/channels with no history or anything persisted. registered users get history and collections
and cloud persistence. so we need a login button next to the theatre button, that brings up the auth gate. and
we need to hide the collections feature and history from non registered users. we need to test end to end
persistence in the browser and in the cloud and registered vs unregistered flow." This supersedes the signed-out
homes of `docs/61` and the offline escape of `docs/62`: persistence is a registered feature, full stop.

## 1. The model

| | Unregistered | Registered |
|---|---|---|
| Browsing (catalog, channels, player, live) | full | full |
| Watch history | none - no UI, no writes | the account (cloud), every runtime |
| Collections, favorites | hidden / disabled with reason | the account |
| Settings, shell/layout, last channel | session only - nothing saved | the account |
| The local stores (`docs/61`) | unused | the settings' offline mirror (D8) only |

One mental model, no per-runtime rows: the account is the only persistence home, the local stores stop being a
signed-out home, and the desktop's fileserver rows stop being a signed-out home too. A person who wants their
place kept signs in - the same on the web and on the desktop.

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
`offersOfflineEscape` and `continueOffline` leave with their tests. Unregistered: `writeWatch` is never called
(the Player guards on the session), no settings/shell/last-channel write leaves the app, the resolver answers
`unavailable` for every domain and the transports skip their calls entirely.

### 3.2 Registered history: the account owns it

Migration `032-user-watch.sql` (next after `031`): `user_watch` - `id TEXT PRIMARY KEY`, `account_id FK
admin_accounts ON DELETE CASCADE`, `item_kind`, `item_id`, `season`, `episode`, `position_ms`, `duration_ms`,
`state` (`watching` | `watched`), `updated_at`, `playback_id`, `seq`, with the fileserver's unique-per-item-
episode identity (a UNIQUE index on `(account_id, item_kind, item_id, COALESCE(season,0), COALESCE(episode,0))`)
and the `idx` on updated_at. Routes `PUT/DELETE /api/account/watch(/:watchId)`, `DELETE /api/account/watch`,
`GET /api/account/watch` (the account's entries, newest first) - behind `anySignedIn`, the same envelope and
refusal shapes the fileserver's watch routes answer, with the shared semantics applied at write time (threshold,
clamp, sticky - `src/shared/watch`, so there is one implementation on both servers). A migration `032-user-shell`
table in the same file: `user_shell (account_id PK, shell TEXT, updated_at)`; `GET/PUT /api/account/shell`
whole-document, validated by the shell wire schema.

### 3.3 The resolver's new matrix

| Domain | Signed in | Signed out |
|---|---|---|
| watch, collections, favorites, settings | account | unavailable - no UI, no writes |
| shell | account | unavailable |

The local backends remain wired for one thing only: the settings mirror (D8 - account writes mirror to the
browser's local cache so a signed-out next visit still has a theme). The watch mirror is dropped entirely:
`local-watch.ts` and its IndexedDB store leave the resolver and the wave (the account is the only watch home;
a device that is offline writes nothing). `local-state.ts` keeps only `giga.v1.settings` as the signed-in
mirror; `giga.v1.shell` and `giga.v1.lastChannelId` go - the shell follows the account now.

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
| Backend | Migration `032` (user_watch, user_shell); `store/user-watch-repository.ts`, `store/user-shell-repository.ts`; `/api/account/watch*`, `/api/account/shell` routes; tests |
| Frontend | The resolver matrix (§ 3.3); the titlebar control + the dialog gate; App.tsx without the wall; the hide rules (§ 3.4); the Player's signed-out write guard; tests |
| Docs | `docs/02` (session-gated surfaces), `docs/04` (what survives, § 1's table), `docs/06` (the titlebar control, the hidden sections), `docs/61`/`docs/62` supersession notes |

## 5. Tests

- Backend: the migration (identity uniqueness per account, cascades); watch write/threshold/sticky/episode
  identity per account, remove/clear/list ordering, cross-account isolation; shell GET/PUT round-trip; every
  route 401 signed out.
- Frontend: the resolver matrix cells; signed-out emits no calls (fetch throws if reached) and renders no
  collections/history; the dialog gate opens/closes/returns focus; signed-in writes go to the account; the
  signed-in settings mirror still lands locally.

## 6. End-to-end (the owner's acceptance, coordinator on the real stack)

1. **Browser, unregistered**: browse channels and a title, move layout, reload - nothing came back: default
   layout, no history, no Continue, no collections anywhere, no `giga.*` keys but the settings mirror's absence,
   no watch rows server-side.
2. **Browser, registered**: sign in through the titlebar control, play to a position, build a collection, change
   theme - reload: signed in (cookie restore), history and Continue back, collection back, theme back, all from
   the account. A second browser profile signing into the same account sees the same history and collections
   (the cloud is the home, not the device).
3. **Registered vs unregistered side by side**: the unregistered profile shows no history/collections surfaces
   at all; signing in makes them appear without a reload.
4. **Desktop**: registered signs in and sees the same account data; signs out and keeps browsing with nothing
   persisted.
5. The gate's forgot-password flow through `/api/auth/*`, and `writes.closed` remains on the public deployment
   until accounts are the only writers.
