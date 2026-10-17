# 07 - Working Protocol

**Status: binding for every session and every worker agent.** How work on Giga Stream is done:
who decides, how changes are made and checked, and when and how work is delegated. The engineering
rules are in `01`; this document is about process.

## 1. Roles

- **The owner** decides what the product is and how it looks. The owner's words are the authority;
  a rule from an earlier session or document never outranks something the owner said.
- **The coordinator** is the session working with the owner. It writes the docs, briefs workers, lands
  their work, runs every check, reviews every visual result in the browser, packages each wave, and
  reports to the owner. It does not implement wave code (owner, 2026-10-17); code work goes to workers.
- **A worker** is a subagent given one brief. It writes and compiles code in its own worktree, and
  stops.

## 2. How the coordinator works

- **Docs come first and describe only what is decided or verified.** Nothing is copied from an older
  document, another project or memory unless it has been checked against the code, the tool or the
  owner. What is specified but not yet built is written as a requirement, never as a fact about the
  code.
- **Port from source, not from docs.** When a reference app already does the thing (Giga Images for the
  shell, Giga Cut for the splitter and popups, the earlier Giga Stream code in the archive), its files
  are ported near-verbatim and edited minimally, then compared side by side with the reference.
- **Visible first.** A screen is rendered and looked at after every increment, against a *fresh*
  screenshot of the reference, never an old one and never only through tests.
- **Answer the question that was asked.** When the owner asks why, the answer is the plain reason, not
  an audit of something else. When the owner asks for a change, make it; do not offer a menu.
- **Act; ask only when blocked.** A decision the owner has to make is asked once, plainly. Everything
  else proceeds on the obvious default, and the default is stated in one line.
- **Report outcomes as they are.** A check that did not run is said to have not run; a test that failed
  is shown failing; something not verified is called unverified.

## 3. Changing files

- Edit with the editor tools, one file at a time. Never write a script or shell command that writes
  source or doc files.
- The shell runs things: installs, builds, checks, tests and programs.
- Never reset, revert, stage or commit changes that are not yours. Commit only your own paths, with a
  message saying what and why, ending with the session's `Co-Authored-By` trailer.
- Nothing is pushed or published without the owner's say.

## 4. Running things

- **Ask before starting a program** the owner did not ask for. Restarting the owner's own stack when
  asked is fine.
- **The dev stack runs from the root, in the background, during development and testing** (owner,
  2026-10-17). `npm run dev` is the only launcher (the backend, the interface's Vite on 5171, the
  Electron app with its fileserver 8090, the live server 8097; kill-ports frees the development ports
  first, never a production one). The window loads Vite, so edits reload in place. On Windows, start
  that npm command in the background through the Windows process service and retain its PID. A plain `Start-Process` is still
  tied to the automation shell's Windows job and is killed when that shell call exits:

  ```powershell
  $root = (Get-Location).Path
  $stdout = Join-Path $env:TEMP "giga-stream-dev.log"
  $stderr = Join-Path $env:TEMP "giga-stream-dev.err.log"
  $command = 'cmd.exe /d /c "cd /d ""{0}"" && npm run dev > ""{1}"" 2> ""{2}"""' `
    -f $root, $stdout, $stderr
  $stack = Invoke-CimMethod -ClassName Win32_Process -MethodName Create `
    -Arguments @{ CommandLine = $command }
  $stack.ProcessId
  ```

  This returns immediately while the stack stays running. Checks and drives use that stack, never
  ad-hoc per-program spawns, and do not stop it as drive cleanup. When explicitly stopping it, use
  `taskkill /PID $stack.ProcessId /T /F` so the whole launcher tree exits.
- **Development and production never share a port** (owner, 2026-10-17; the table is `03` section 1).
  The installed app runs on the production ports (fileserver 8190, backend 8191, live server 8197,
  preview 5271) so the owner can test it while the dev stack runs on the development ones. Nothing
  started for development takes a production port, and nothing stops a process on one.
- **Checks never touch the owner's data or running app.** A check runs the fileserver and the admin
  backend with temporary `DATA_DIR`s, on free ports, and serves its own build of the interface. The
  owner's `~/.giga-stream`, saved layout and Electron window are not test fixtures.
- **Page-level fakes** (a socket hello, a fetch) live in a harness outside the repository and never
  write to a real server.
- **Stop processes by PID**, never by image name; killing `electron.exe` or `node.exe` by name takes
  down the owner's session.
- **Never run `npm ci` in a program whose app is running**: it deletes `node_modules` before it
  installs, and a locked file stops it halfway.
- Browsers used for checks are headless and muted.

## 5. Verification

- A visible feature is done when it has been run in the browser or the Electron window, looked at, and
  compared with the reference, and the gate passes. Compiling is not done.
- **Chrome MCP visual acceptance is mandatory for every frontend wave** (owner, 2026-10-17). With the
  root `npm run dev` stack still running, the coordinator opens the real interface in the connected
  Chrome MCP, checks every touched surface and pane at both required viewport sizes, and compares it to
  the exact governing sections of `02`, `04` and `06`. Console errors, failed/invalid network answers,
  missing controls, invented placeholder compositions and undocumented visual changes fail the wave.
- **State grammar is checked visually, not inferred from unit tests.** Loading and empty content regions
  draw the documented skeletons. A wiring change never replaces established controls with an empty-state
  card, dash facts or native controls that the page docs did not specify; a control works or remains in
  place disabled with its documented accessible reason.
- **Wiring preserves the completed UI.** A worker must compare touched markup with the accepted visual
  baseline before editing. Missing media/history may disable actions, but never remove inspector headings
  or the Resume / Start over footer. The idle source-less video remains mounted. Any redesign or new
  placeholder composition requires an explicit owner decision, recorded before implementation.
- **Embed acceptance uses the owner's current policy:** no iframe `sandbox` attribute in either runtime.
  This is distinct from Electron's renderer-process sandbox; do not disable that process protection.
- **The real wire is part of acceptance.** The coordinator drives the fileserver answers used by the
  surface, verifies them against the frontend schemas, and sweeps the touched paths for stubs, mocks and
  fixture imports. One malformed composite child must not discard valid siblings. A wave is not accepted
  while a fileserver-owned value still comes from a frontend fixture or a service still returns a phase-one
  refusal.
- The default test run is fast (seconds). Heavy suites are opt-in and run once at the end.
- The gate (`node scripts/check/gate.mjs`) runs every typecheck, the lint, the rule checker and every
  program's tests, and must print `gate: PASS`.
- Its result is reported as it ran.

## 6. Delegation

### 6.1 When

- **One worker per real sub-project** (the admin backend, the fileserver), and only when the pieces are
  independent and large enough to be worth a brief. Never split one piece, and never one set of docs,
  across several workers, unless the owner directs otherwise under the next point.
- **The owner may direct a finer split for a named plan**, for example one worker per surface of the
  interface. The plan's document records the split, the owner of every path, and the landing order. The
  coordinator still lands every branch, runs every check and reviews every visual result (section 6.5).
- **Every code wave is delegated** (owner, 2026-10-17). A foundation another wave needs gets its own
  worker and is landed, checked and committed before dependent worktrees are cut. This preserves the
  dependency order without making the coordinator an implementer.
- **Never delegate:** docs and contracts (one voice, the coordinator's), landing and review, packaging,
  and any check that needs a running service.

### 6.2 The brief

Six parts, in order, self-contained (the worker has seen none of the conversation):

1. **Where:** the worktree path, branch and base commit; the folders it may change.
2. **Rules:** this protocol, `01`, and anything wave-specific, quoted where short.
3. **Role:** what it does and does not do (6.3).
4. **Read first:** `AGENTS.md`, then the exact doc sections and source files, in order. Every worker reads
   `AGENTS.md` and the doc sections its brief names before it writes a line.
5. **Scope:** the deliverable file by file; what is out of scope; whose files are off limits.
6. **Report:** the format in 6.4.

### 6.3 A worker

- works only in its own worktree and branch, and only on the folders its brief names;
- makes its code compile clean: `npm ci` in the programs it touches, their `typecheck`, the lint where
  there is one, and `node scripts/check-rules.mjs`, with every error fixed;
- writes the tests the work needs but **does not run the suite**, start a program, open a browser or
  take a screenshot. A visual worker builds the controls its brief names, in the states its doc section
  gives, and the coordinator looks at the rendered result at landing (section 6.5, step 3);
- edits with the editor tools only and never writes files with a script;
- commits on its own branch and never pushes, merges or rebases;
- never edits a document;
- takes the simplest reading where the docs leave a gap, consistent with `01` and `03`, and lists every
  such choice in its report.

### 6.4 The report

The branch and each commit; files created, changed and deleted; each route, frame or table delivered
and the doc section it implements; the typecheck, lint and rule-checker results as run; the tests
written, stated as written and not run; every gap it filled and how; anything left undone.

### 6.5 Landing

1. The coordinator reads the report as a claim, not as evidence, and reads the diff.
2. It merges the branch, runs `npm ci` where a lockfile changed (never under a running app, 4), and runs
   the gate.
3. It runs the real checks the worker could not: the programs started on free ports with temporary
   data, driven over HTTP (the fileserver has no socket, `03` section 4), restarted and re-read. For a
   frontend wave it also completes section 5's Chrome MCP visual acceptance before the branch is called
   landed.
4. A failure goes back to the **same** worker with the exact output. The coordinator does not quietly
   fix a worker's defect and report the work as clean.
5. A worker that broke a rule is told, and the breach is recorded in the landing commit message.
6. **Only when the wave's gate, real-wire checks and Chrome MCP visual acceptance pass does the
   coordinator produce the Windows app**
   (owner, 2026-10-17): `npm run dev`'s stack may keep running; `npm run dist:win` at the root builds the
   interface and the fileserver and packages them with electron-builder. The result is
   `release/Giga Stream Setup <version>.exe` (the installer) and `release/win-unpacked/Giga Stream.exe`
   (runs without installing). It runs on the production ports, so the owner tests the wave in it without
   disturbing development. Only the fileserver ships in it, with the built interface it serves, the shared
   media library and FFmpeg; the admin backend and the live server are separate programs and never do. A
   packaging failure is a wave failure, reported as it ran.
7. The coordinator records what landed and what was verified, and tells the owner, giving the exe's path.

Worktrees live under `D:\Projects\.giga-worktrees\`, one per worker, and are removed when their branch has
landed. A worktree is cut from a commit, so before any worker is briefed the coordinator commits the
baseline it will cut from: the work-in-progress the plan depends on, on a named baseline branch, with its
own paths only. Uncommitted work is not in a worktree. Each worker runs `npm ci` in its own worktree, never
in a tree whose app is running.
