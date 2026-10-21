# 62 - User accounts plan

**Status: plan, written before the code (coordinator, branch `dev`).** Its proxy transport is superseded by `64`:
the fileserver terminates account/auth routes and reads or writes Turso directly. Owner, 2026-10-19: phase 2 "will be
adding the user api to the backend to persist profile, collections, settings, favorites. we might be able to
make the current user infrastructure by just adding a type to the table row. just need to see what changes we
would need to make to the admin console"; "phase 2 needs an auth gate on the frontend. and we arent using
email, so they can use the same security question reset flow". This document records what the code does today
(read file by file; the code wins over the docs), the decisions, the design, the change list, the tests, the
failure modes and how the coordinator verifies it on the real stack. Plan 1 is `docs/61`: the browser
localStorage / desktop SQLite split, which lands first.

## 1. What exists today (verified)

### 1.1 Backend accounts and sessions (`src/backend/src`)

| Piece | Where | Finding |
|---|---|---|
| Accounts table | `store/migrations/002` as amended by `015`, `019`, `021`, `018` | `admin_accounts`: `id`, `username`, `username_key` (lower-cased, UNIQUE), `password_hash` (scrypt), `disabled`, `session_version`, `failed_sign_ins`, `locked_until`, `security_question` (1-8), `security_answer_hash`, timestamps. **No role and no name**: `015` dropped role (D22, every admin equal), `021` dropped the unused display name. No email anywhere: `019` renamed the columns to username. |
| Refresh tokens | `002` | SHA-256 hashed, single-use; presenting a used token revokes every session of the account. |
| Reset attempts | `018` | Counted per `username_key`, known or unknown, so an unknown name locks the same way. |
| Auth routes | `api/auth.ts` | `login`, `refresh` (body token **or** cookie; rotation on every refresh), `restore`, `logout`; refusal codes under `auth.*`. |
| Cookie | `api/refresh-cookie.ts` | `giga_refresh`, `Path=/api/admin/auth`, `HttpOnly`, `SameSite=Strict`, `Secure` on https. The access token is never in it; the admin app keeps tokens in memory only (`services/auth-port.ts`: "the store holds the tokens"), so a reload restores through the cookie. |
| Guard | `api/guard.ts` | `signedIn` is the single choke point (`services.auth.authenticate(authorization)`); `isAdmin` is its non-refusing variant for public reads. `Principal` carries `accountId`. |
| Account verbs | `api/accounts.ts` | Create, patch (a self password change or self disable revokes the caller's sessions), `PUT /:id/security-question` (docs/54). |
| Reset flow | `api/auth-security.ts` (docs/40) | `reset-start` answers the question picklist number; `reset` verifies the answer hash and sets the password. Username-keyed throughout. |

### 1.2 Admin console (`src/admin/src`)

`SignInPage`; the auth port seam (`services/auth-port.ts`: `signIn`, `restore`, `signOut`, `resetStart`,
`resetPassword`, never rejects); `AccountSchema` (`services/schemas/account-schema.ts`: `id`, `username`,
`disabled`, `createdAt`, `updatedAt`, `lastSignInAt?`, `securityQuestionSet?`, deliberately non-strict);
`AccountsPage` (bulk toolbar, `New account`, per-account workspace) with the flow services `account-flows`,
`account-password-flow`, `account-question-flow`, `account-bulk`, `account-state`.

### 1.3 Fileserver and frontend

- The reverse proxy (`src/fileserver/src/build-app.ts` `registerAdminProxy`, config `ADMIN_PROXY_TARGET`,
  `config.ts` 43/65) forwards `/admin` and `/api/admin` when the env is set; empty (the desktop default) leaves
  it off.
- Collections, favorites and settings are the **fileserver's own** routes over its local SQLite
  (`routes/collections.ts`, `routes/favorites.ts`, `routes/settings.ts`): one shared store, no users, no auth.
- The frontend has no authentication at all. Plan 1 (`docs/61`) gives the browser local persistence for shell,
  settings, watch history and the last channel, with favorites/collections deliberately left server-side.

## 2. Decisions

| # | Decision |
|---|---|
| D1 | The owner's "type on the row": `ALTER TABLE admin_accounts ADD COLUMN kind TEXT NOT NULL DEFAULT 'admin' CHECK (kind IN ('admin','user'))`. No new table; scrypt hashes, refresh tokens, `session_version`, lockout, `reset_attempts` and the audit log are reused untouched. |
| D2 | Usernames only, no email, exactly as the console is today; the reset flow is username-keyed and is shared as-is for `kind='user'` (owner, 2026-10-19). |
| D3 | `/api/admin/*` requires `kind='admin'`, refused at the one choke point (`signedIn` → the authenticate call gains the required kind). The app's `/api/account/*` accepts any enabled account, so an admin may use the app but a user can never touch the console. |
| D4 | The app copies the console's token transport: access token in memory, rotating refresh in an httpOnly cookie scoped to `/api/account/auth`. Never localStorage (docs/01 as amended by docs/61). |
| D5 | Profile **is** the account row (id, username, kind, securityQuestionSet, createdAt). No profile table and no display name until one is actually wanted — `021` already removed it once for being unused. |
| D6 | Settings, collections and favorites become per-account tables on the backend. The fileserver's shared routes are superseded for signed-in use and deprecated once the frontend is fully re-pointed. |
| D7 | The fileserver proxies `/api/account` to the same upstream as `/api/admin`; when the env is empty the proxy falls back to the `adminUrl` **setting**, so an installed desktop app can be pointed at the cloud backend without a rebuild. Proxy target empty and no setting: signed-out local mode. |
| D8 | The merge rule is a conscious choice: at sign-in the account's settings win **once**, and the events drawer says plainly that local changes were replaced. A sign-in prompt with a diff is a docs/06 follow-up if the owner wants it; silent loss without a word is not acceptable. |
| D9 | `docs/61`'s resolver is the only storage switch. This plan adds the account backend and flips the resolver's `signedIn` input; no domain gains a second mechanism, and the per-domain homes stay a single matrix (§ 3.6). |
| D10 | `admin_accounts` keeps its name. A rename is a full table rebuild for no behaviour; the `kind` column and this plan carry the semantics. Revisit only if a third kind ever appears. |
| D11 | The security-question reset for public accounts is an accepted risk for now: answers are guessable and per-username lockout lets a stranger lock a victim out on purpose. The lockout already clears on success and the attempts are capped; revisit (rate limits per address, or an invite-only gate) if public sign-ups open beyond a private circle. |

## 3. Design

### 3.1 Migration `031-accounts-kind.sql` (next after `030`)

- The `kind` column (D1). Existing rows are admins by default; nothing else changes.
- `user_settings (account_id PK REFERENCES admin_accounts ON DELETE CASCADE, settings TEXT NOT NULL, updated_at)`
  — `settings` holds the JSON of the settings wire schema, validated on every write.
- `user_favorites (account_id, ref_kind, ref_id, created_at, PRIMARY KEY (account_id, ref_kind, ref_id))`.
- `user_collections (id, account_id, name, type, created_at, updated_at)` and
  `user_collection_items (collection_id REFERENCES user_collections ON DELETE CASCADE, ref_kind, ref_id,
  added_at, PRIMARY KEY (collection_id, ref_kind, ref_id))` — the fileserver's collection shapes, per account.

### 3.2 Auth for the app: `/api/account/auth/*`

`login`, `refresh`, `restore`, `logout` reuse `services.auth` and the session service unchanged; the cookie is a
second instance scoped `Path=/api/account/auth`. `authenticate` gains the required-kind parameter; the admin
plugin registers its routes with `kind='admin'` (D3). `Principal` carries `kind` so the audit log can tell the
console's actors from the app's.

### 3.3 User data routes `/api/account/*`

`GET /me` (the profile, D5); `GET`/`PUT /settings` (whole-document replace, validated by the settings wire
schema); `PUT`/`DELETE /favorites/:kind/:id` and `GET /favorites`; the collections CRUD and item verbs the
fileserver serves today, re-pointed at the account's rows. Every route begins with `signedIn`; cross-account
access is impossible by construction because every query filters on the principal's `accountId`.

### 3.4 Fileserver

`registerAdminProxy` widens to forward `/api/account` beside `/api/admin` (same upstream, same `x-forwarded-for`
rules). D7's fallback: env, else the `adminUrl` setting read at boot. With neither, the proxy stays off and the
app runs signed-out.

### 3.5 Frontend auth gate

**Superseded in part (owner, 2026-10-20, `docs/63`):** the gate is no longer a wall - unregistered visitors
browse with nothing persisted, and a titlebar control beside Theatre opens the gate as an overlay dialog. The
offline escape is retired (browsing signed-out IS the default state). What stands: the session transport
(memory token, cookie restore), the settings merge (D8), the per-domain matrix as amended by `docs/63` § 3.3.

A sign-in surface shown before the three surfaces; behind it the app as it is today. The session lives in the
store (memory), `restore` runs at boot through the cookie, sign-out clears and returns to the gate. The gate's
refusals are the console's sentence set (`lib/auth-errors`), re-worded for the app. An unreachable backend is a
truthful refusal; on the **desktop runtime only** the gate offers "continue offline", which is today's
local-only behaviour — the public web stays account-gated with no offline escape.

### 3.6 Where each domain lives: the one matrix

The resolver of `docs/61` (§ 2.2 there) is the single switch; its `signedIn` input stops being pinned and the
account backend joins it:

| Domain | Desktop signed out | Desktop signed in | Browser signed out | Browser signed in |
|---|---|---|---|---|
| Shell, layout, last channel | fileserver SQLite | fileserver SQLite | localStorage | localStorage |
| Watch history | fileserver SQLite | fileserver SQLite | IndexedDB (`docs/61`) | IndexedDB |
| Settings | fileserver SQLite | **account** | localStorage | **account**, local as cache |
| Favorites, collections | unavailable — the controls say why | **account** | unavailable — the controls say why | **account** |

Sign-in applies D8 once (account settings win, the drawer speaks). Sign-out keeps the device's local state
(nothing is wiped).

### 3.7 Admin console changes (the answer to the owner's question)

| Surface | Change |
|---|---|
| `account-schema.ts` | `kind: z.enum(["admin","user"]).optional()` (non-strict; absent means admin, so old answers still read). |
| `AccountsPage` index | A kind column and a kind filter chip in the existing toolbar patterns (docs/41, docs/55); the bulk toolbar applies to the filtered kind as today. |
| `New account` flow | A kind choice; a `kind='user'` account is created exactly like an admin one otherwise. |
| Account workspace | Kind shown read-only beside the username. |
| Password, disable, security-question flows | **Unchanged** — username-keyed, they work for both kinds (D2). |
| The console's own auth | Unchanged; a `kind='user'` token at any `/api/admin/*` route is a 401 at the guard, and the console shows its sign-in page again. |
| Audit | No change; actions already record the actor, now with its kind. |

## 4. Change list

**Wave 0 — close the live exposure first.** The review of this plan caught what neither plan had written down:
the public fileserver on gigastream.app serves unauthenticated `PUT`/`PATCH`/`DELETE` routes for settings,
favorites, collections and watch history over **one shared store** — any visitor can change them for everyone,
today. Before any account work, a deployment env (e.g. `REQUIRE_ACCOUNT_WRITES`) makes the fileserver refuse
those writes with the standard envelope (`403 writes.closed`); the Render service sets it, desktops never do.
The browser frontend treats the refusal as the spoken warning it already handles, and `docs/61`'s local stores
make the browser lossless anyway. The flag dies once `kind='user'` accounts are the only writers.

**Wave 1 — the backend and the console.** Migration `031`, the kind check at the guard, `/api/account/auth/*`
and `/api/account/*`, the fileserver's `/api/account` proxy, and the console's kind column, filter and create
choice (§ 3.7) — everything needed to mint and manage a user account.

**Wave 2 — the gate.** The frontend auth gate, the session slice with restore and sign-out, the re-pointed
favorites/collections/settings services and the D8 merge, the desktop offline escape, and the doc amendments.

| Program | Change |
|---|---|
| Backend | Migration `031`; `Principal`/`authenticate` kind support; `/api/account/auth/*` and `/api/account/*` routes; account create/list answers carry `kind`; tests. |
| Fileserver | The proxy forwards `/api/account`; the `adminUrl` setting fallback (D7); tests. |
| Frontend | The auth gate surface; session store slice; restore/sign-out; collections/favorites services re-pointed to `/api/account/*`; the settings merge rule; tests. |
| Admin | The console changes of § 3.7; tests. |
| Docs | `docs/02` (the gate, the session), `docs/03` (the account routes, the cookie), `docs/06` (the sign-in surface), `docs/26` D22 note (kind reintroduces a distinction admins/user, by owner decision), `docs/61` cross-reference. |

## 5. Tests

- **Backend**: the migration (default `admin`, the CHECK holds); the guard refuses `kind='user'` on
  `/api/admin/*` and admits it on `/api/account/*`; login/refresh/restore/logout for a user account, lockout,
  the full reset flow; settings/favorites/collections CRUD per account; cross-account isolation; token reuse
  revocation unchanged.
- **Fileserver**: `/api/account` forwarding with and without the setting fallback; proxy off stays off.
- **Frontend**: the gate (signed out, restore, sign out, the desktop offline escape, no escape in the browser);
  the settings merge rule at sign-in and sign-out; the re-pointed services.
- **Admin**: kind column, filter, create flow; every existing suite passes unchanged.

## 6. Failure modes

| Failure | Behaviour |
|---|---|
| Backend unreachable | Desktop: "continue offline" (local-only state). Browser: the gate with the truthful refusal; local persistence from docs/61 still hydrates behind it. |
| Locked or disabled account | The console's existing lockout and disabled sentences, reused. |
| A user token at the console | 401 at the single choke point; the sign-in page returns; nothing audited (no admin action happened). |
| Refresh cookie lost | The session ends at the next reload; sign-in again. `session_version` revocation semantics unchanged. |
| Two devices on one account | Settings last-write-wins per `PUT`; favorites and collections are additive sets that merge naturally. |
| A stranger failing someone's reset on purpose | Locks that username out of reset (not sign-in) for the lockout window; capped and cleared on success — accepted, see D11. |
| The shared-store writes before accounts ship | Refused on the public deployment by wave 0's flag; the desktop keeps its local writes (the flag is unset there). |
| The fileserver's shared settings row | Remains for signed-out desktop use; deprecated for the browser once accounts are the only path. |

## 7. Verification on the real stack (coordinator)

1. Create a `kind='user'` account in the console; open the app in Chrome: the gate signs in, settings and
   favorites persist across a reload (cookie restore) and across a second browser on the same account.
2. The same token against `/api/admin/*`: 401, the console's sign-in page returns.
3. The reset flow from the app's gate for the user account: question, answer, new password, sign-in.
4. The desktop app pointed at the cloud backend: sign-in, stop the backend, "continue offline" — the app works
   local-only; restart with the backend up — the session restores.
5. `node scripts/check/gate.mjs`, then the wave's normal visual acceptance at both required sizes.
