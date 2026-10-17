# Agent Guide - Giga Stream

`docs/00-REQUIREMENTS.md` governs this repository and indexes every numbered doc. Read the ones a change
touches before changing behaviour or structure:

| Doc | Owns |
|---|---|
| `00` | what Giga Stream is and how it behaves |
| `01` | the programs, ownership, the locked stack and the rules every file follows |
| `02` | the window, the three surfaces, state, how the interface talks to the fileserver |
| `03` | the two servers: the fileserver first, then the admin backend |
| `04` | navigation between surfaces, windows and popups; what survives a restart |
| `05` | the end-to-end walkthroughs |
| `06` | every surface, pane, window and control |
| `07` | the working protocol: roles, editing, running things, verification, delegation |
| `08` | the build phases and how each is accepted |
| `09` | the FFmpeg build |
| `10` | the live server: channels of real videos as live HLS, its store and CRUD routes |
| `11` | TMDB: the decisions and the API as observed |
| `12` | the provider API reference (verified live 2026-10-16) |
| `13` | the go-live plan |
| `14` | the provider playback proof of concept (`src/mockup`) |

The tree may be dirty: preserve unrelated work, and never reset, revert, stage or commit another
person's changes.

## Layout

- `src/frontend` the React interface (Vite). `src/fileserver` the application server and Electron host;
  it serves the built interface. `src/backend` the optional admin backend; it also serves the live
  channels (`src/backend/src/live`, the `/live` and `/logos` routes; `docs/10`, `docs/26`). `src/mockup` the provider
  playback proof of concept (`docs/14`): plain HTML, CSS and JS, never packaged.
- **Ports: development and production never share one** (owner, 2026-10-17; `docs/03` section 1), so the
  installed app runs beside the dev stack. `NODE_ENV=production` selects production: the packaged app sets
  it, and the servers' `npm start` loads it from their `production.env`.

  | Program | Development | Production |
  |---|---|---|
  | Interface | 5171 (Vite) | 5271 (`npm run preview`); the packaged app is served by its fileserver |
  | Fileserver | 8090 | 8190 (the packaged app) |
  | Admin backend | 8091 (3001 where the local `src/backend/.env` sets it) | 8191 |
- `src/shared/<domain>` libraries any program or tool may import (`docs/01` section 4.2); not programs.
  `src/shared/media` finds and runs the bundled FFmpeg and scans folders for video files.
- `scripts/fixtures` makes the test video files (`docs/10` section 2.1), cached per machine, never committed.
- `scripts/ffmpeg` the FFmpeg build and verifier (`docs/09`); the binaries are in `tools/ffmpeg/bin`
  (gitignored).
- The programs never import each other's source; they talk over HTTP. The interface has no application socket.

## Commands

The dev stack (backend, the interface's Vite, the Electron app with its fileserver, live server; the
development ports above) runs from the root during development and testing (owner, 2026-10-17; `07`
section 4):

- `npm run dev` — the only stack launcher; run it from the repository root (Electron window included).
  The window loads Vite, so edits reload in place.
- To keep it running across automation-shell calls on Windows, launch that command through
  `Win32_Process.Create` exactly as documented in `07` section 4. Do not add alternate stack-launcher
  npm scripts; `Start-Process` is still killed with the automation shell's Windows job.
- `npm run kill-ports` — frees the development ports (5171, 8090, 8091, 3001) by port; never a
  production one, so an installed app the owner is testing keeps running.
- `node scripts/check/gate.mjs` — every typecheck, the lint, the rule checker and every program's tests.
- `npm run dist:win` — builds the interface and the fileserver and packages the Windows app with
  electron-builder (`electron-builder.config.cjs`): `release/Giga Stream Setup <version>.exe`, and
  `release/win-unpacked/Giga Stream.exe` to run without installing. Only the fileserver (with the built
  interface it serves, the shared media library and FFmpeg) is in it; the backend and live server are not.
  The coordinator produces it after every wave (`07` section 6.5).

Checks and drives run against the started stack, never against ad-hoc per-program spawns (`07` section 4).

## Rules that bite (full text: `docs/01`)

- TypeScript strict; never `any`, `@ts-ignore` or a double assertion; external values start as `unknown`.
- Source files at most 200 measured lines, tests 250, wrapped at 120 columns. One exported component
  per file.
- Components `PascalCase.tsx`, hooks `useThing.ts`, everything else kebab-case. No
  `utils`/`util`/`helpers`/`misc`/`common`.
- One Zustand store and one request layer (`services/api.ts`). No application socket, browser storage or polling.
- Routes: parse, one service call, the standard envelope. SQL only under `store/`. Electron only in the
  fileserver's `src/app`. Providers only in the admin backend.
- Every route begins `/api`; only `/healthz` and `/ws` are root-level. Error codes are dotted and stable.
- A control works or is visibly disabled with its reason as a tooltip; no text under controls;
  loading and empty content are skeletons inside the established pane structure. Missing media/history
  never removes the inspector headings or Resume / Start over footer.
- Provider iframes have no `sandbox` attribute in Chrome or Electron (owner, 2026-10-17). Keep Electron's
  renderer process sandbox, context isolation, ad blocker and main-process guards.

## How to work (full text: `docs/07`)

- Edit with the editor tools, one file at a time; never write a script that writes source or docs.
- Automated tests and the gate use free ports and temporary `DATA_DIR`s. **Visual verification and bug-finding
  run against the REAL stack, never an isolated copy** (owner, 2026-10-17: "dont use the isolate fileserver use
  the real fileserver and real backend and find real problems"): the owner's running `npm run dev` stack, with its
  real fileserver (8090), real backend and real data, seen in the real Electron window through its debug port
  (9222) or in a Chrome tab on the Vite port (5171). An isolated copy hides real problems (it hid stale channel
  rows pointing at a dead port, and a video that painted stale after a pane collapsed). On the real stack: change
  only UI state (surface, panes, Theatre) and put it back as found, never delete or overwrite the owner's records
  without asking, and report every real problem seen, whether or not it was the thing asked about.
  Ask before starting a program the owner did not ask for. Stop processes by PID, never by name.
- A worker works only in its own worktree and branch, compiles clean, writes tests but does not run
  them, never edits a doc, commits without pushing, and reports in the format of `docs/07` section 6.4.
- Every code wave, including foundations other waves wait on, is implemented by a worker. The coordinator
  writes docs and briefs, reviews and lands branches, runs checks and real drives, packages, and reports.
- Every frontend wave is visually accepted in the connected Chrome MCP against the root `npm run dev`
  stack, at both required sizes. The coordinator compares each touched surface and pane to its exact
  governing doc, reads console/network failures, and rejects invented empty-state placeholders: loading
  and empty content regions use the documented skeletons while the established controls stay in place.
- A frontend wave is not landed or packaged while a real fileserver answer fails its frontend schema,
  while a control still calls a stub/mock service, or while a fixture supplies data the fileserver owns.
- After every wave lands, the coordinator runs `npm run dist:win` and gives the owner the exe's path, so
  the owner tests the wave without disturbing development (`docs/07` section 6.5).
