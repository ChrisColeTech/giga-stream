# Giga Stream Admin (`src/admin`)

The administrator's app for the admin backend (`src/backend`): channels, providers, titles, playlists, jobs and accounts.
It starts as a clone of the family template (`giga-template-react`), which is the Giga Stream interface, so its pages
are still the template's demo content until the plans below turn them into the admin.

- Development: Vite on `http://127.0.0.1:5172/admin/`, forwarding `/api`, `/live` and `/logos` to the backend
  (`http://127.0.0.1:8091`, or `ADMIN_BACKEND_URL`).
- Production: `npm run build` writes `dist/`; the backend serves it at `/admin/` (`ADMIN_DIST`), and its own Electron
  window opens it.
- Scripts: `npm run dev`, `build`, `typecheck`, `lint`, `test`, `preview` (port 5272).
- Plans: `docs/27-ADMIN-VISUAL-PARITY-PLAN.md` (make it look like the mockup), then
  `docs/28-ADMIN-BACKEND-WIRING-PLAN.md` (wire it to the backend). The product plan is `docs/26`.
- Rules: `docs/01`. The template's tests cover the demo pages and are left alone until plan 1 retires them.
