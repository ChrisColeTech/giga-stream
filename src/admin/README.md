# Giga Stream Admin (`src/admin`)

The administrator's app for the admin backend (`src/backend`): channels, providers, titles, playlists, jobs and accounts.
It began as a clone of the family template (`giga-template-react`), which is the Giga Stream interface, and is built on
the family UI library (`src/shared/ui`, imported as `@giga/ui/...`) and the request layer (`src/shared/http`). The shell
(titlebar, statusbar, Events drawer, Settings window, sign-in page) and the six tabs' index skeletons are drawn from
fixtures; each tab's New form, list and workspaces arrive wave by wave (`docs/28`).

- Development: Vite on `http://127.0.0.1:5172/admin/`, forwarding `/api`, `/live` and `/logos` to the backend
  (`http://127.0.0.1:8091`, or `ADMIN_BACKEND_URL`).
- Production: `npm run build` writes `dist/`; the backend serves it at `/admin/` (`ADMIN_DIST`), and its own Electron
  window opens it.
- Scripts: `npm run dev`, `build`, `typecheck`, `lint`, `test`, `preview` (port 5272).
- Address switch while the data is fixtures: `?signedin=0` opens on the sign-in page.
- Plans: `docs/28-ADMIN-VISUAL-PARITY-PLAN.md` (the pages, from fixtures), then `docs/29-ADMIN-BACKEND-WIRING-PLAN.md`
  (wire it to the backend). The shared library is `docs/27`. The product plan is `docs/26`.
- Rules: `docs/01`.
