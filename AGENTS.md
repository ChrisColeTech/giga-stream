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
| `10` | the streaming test server |
| `11` | TMDB: the decisions and the API as observed |
| `12` | the provider API reference (verified live 2026-10-16) |
| `13` | the go-live plan |
| `14` | the provider playback proof of concept (`src/mockup`) |

The tree may be dirty: preserve unrelated work, and never reset, revert, stage or commit another
person's changes.

## Layout

- `src/frontend` the React interface (Vite, port 5171). `src/fileserver` the application server and
  Electron host (port 8090). `src/backend` the optional admin backend (port 8091). `src/mockup` the
  provider playback proof of concept (`docs/14`): plain HTML, CSS and JS, never packaged.
- `src/shared/<domain>` libraries any program or tool may import (`docs/01` section 4.2); not programs.
  `src/shared/media` finds and runs the bundled FFmpeg and scans folders for video files.
- `scripts/fixtures` makes the test video files (`docs/10` section 2.1), cached per machine, never committed.
- `scripts/live-server` the streaming test server (port 8097, `docs/10`); it streams those fixture files. `scripts/ffmpeg` the FFmpeg
  build and verifier (`docs/09`); the binaries are in `tools/ffmpeg/bin` (gitignored).
- The programs never import each other's source; they talk over HTTP and WebSocket.

## Commands

Added in phase 0 of `docs/08`, when `package.json` exists.

## Rules that bite (full text: `docs/01`)

- TypeScript strict; never `any`, `@ts-ignore` or a double assertion; external values start as `unknown`.
- Source files at most 200 measured lines, tests 250, wrapped at 120 columns. One exported component
  per file.
- Components `PascalCase.tsx`, hooks `useThing.ts`, everything else kebab-case. No
  `utils`/`util`/`helpers`/`misc`/`common`.
- One Zustand store, one request layer (`services/api.ts`), one socket (`services/events.ts`). No
  browser storage, no polling.
- Routes: parse, one service call, the standard envelope. SQL only under `store/`. Electron only in the
  fileserver's `src/app`. Providers only in the admin backend.
- Every route begins `/api`; only `/healthz` and `/ws` are root-level. Error codes are dotted and stable.
- A control works or is visibly disabled with its reason as a tooltip; no text under controls;
  loading and empty are skeletons.

## How to work (full text: `docs/07`)

- Edit with the editor tools, one file at a time; never write a script that writes source or docs.
- Checks use free ports and temporary `DATA_DIR`s, never the owner's `~/.giga-stream` or running app.
  Ask before starting a program the owner did not ask for. Stop processes by PID, never by name.
- A worker works only in its own worktree and branch, compiles clean, writes tests but does not run
  them, never edits a doc, commits without pushing, and reports in the format of `docs/07` section 6.4.
