# 07 - Working Protocol

**Status: binding for every session and every worker agent.** How work on Giga Stream is done:
who decides, how changes are made and checked, and when and how work is delegated. The engineering
rules are in `01`; this document is about process.

## 1. Roles

- **The owner** decides what the product is and how it looks. The owner's words are the authority;
  a rule from an earlier session or document never outranks something the owner said.
- **The coordinator** is the session working with the owner. It writes the docs, does all visual
  work itself, briefs workers, lands their work, runs every check, and reports to the owner.
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
- The default test run is fast (seconds). Heavy suites are opt-in and run once at the end.
- The gate (`node scripts/check/gate.mjs`) runs every typecheck, the lint, the rule checker and every
  program's tests, and must print `gate: PASS`.
- Its result is reported as it ran.

## 6. Delegation

### 6.1 When

- **One worker per real sub-project** (the admin backend, the fileserver), and only when the pieces are
  independent and large enough to be worth a brief. Never split one piece, and never one set of docs,
  across several workers.
- **Never delegate:** docs and contracts (one voice, the coordinator's), visual work, anything another
  piece waits on that the coordinator can finish directly, and any check that needs a running service.

### 6.2 The brief

Six parts, in order, self-contained (the worker has seen none of the conversation):

1. **Where:** the worktree path, branch and base commit; the folders it may change.
2. **Rules:** this protocol, `01`, and anything wave-specific, quoted where short.
3. **Role:** what it does and does not do (6.3).
4. **Read first:** the exact doc sections and source files, in order.
5. **Scope:** the deliverable file by file; what is out of scope; whose files are off limits.
6. **Report:** the format in 6.4.

### 6.3 A worker

- works only in its own worktree and branch, and only on the folders its brief names;
- makes its code compile clean: `npm ci` in the programs it touches, their `typecheck`, the lint where
  there is one, and `node scripts/check-rules.mjs`, with every error fixed;
- writes the tests the work needs but **does not run the suite**, start a program, open a browser or
  take a screenshot;
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
   data, driven over HTTP and the socket, restarted and re-read.
4. A failure goes back to the **same** worker with the exact output. The coordinator does not quietly
   fix a worker's defect and report the work as clean.
5. A worker that broke a rule is told, and the breach is recorded in the landing commit message.
6. The coordinator records what landed and what was verified, and tells the owner.

Worktrees live under `D:\Projects\.giga-worktrees\`, one per worker, cut from the coordinator's current
commit, and are removed when their branch has landed.
