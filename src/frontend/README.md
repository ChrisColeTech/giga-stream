# Giga Stream - the interface (`src/frontend`)

The React interface of Giga Stream: three surfaces (Live, Library, Player), the titlebar and statusbar, and the
Settings and Collections windows. It runs in Electron and, for development and checks, in a browser.

The specification is `docs/02` (the window, state and transport), `docs/04` (navigation), `docs/05` (the walks),
`docs/06` (every surface and control) and `docs/21` (how the interface is built, in two phases). The rules every
file follows are `docs/01`, and `AGENTS.md` at the repository root summarises them.

## Phases

- **Phase 1 - look and feel (in progress).** Every surface and window is drawn from the typed fixtures in
  `src/fixtures/`. Nothing calls the fileserver. A control that needs data is visibly disabled with its reason.
- **Phase 2 - wiring.** Each fixture is replaced by a call through `src/services/api.ts` to the fileserver, and
  `src/fixtures/` is deleted.

The interface never talks to the admin backend. Data reaches it only through the fileserver's `/api`.

## Run

```
npm ci             # from the lockfile, never under a running app
npm run dev        # http://127.0.0.1:5171 (proxies /api to the fileserver on :8090)
npm run typecheck
npm run lint
npm test
```

## Rules this interface follows

- TypeScript strict. No `any`, no `@ts-ignore`, no double assertion; external values start as `unknown`.
- One exported component per file, named for the file; hooks are `useThing.ts`; everything else kebab-case.
- No file over 200 measured lines (tests 250), wrapped at 120 columns.
- One Zustand store. No browser storage, no WebSocket, no polling.
- Motion is framer-motion only; durations and eases come from `index.css` and `constants/timing.ts`.
- A control works, or is visibly disabled with its reason as its tooltip. No text sits under a control.
