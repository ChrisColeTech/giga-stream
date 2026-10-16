#!/usr/bin/env node
// The gate: one verdict over every check a change must pass before it is merged or pushed.
// Usage: node scripts/check/gate.mjs [--root <worktree>]
//
// Steps run in order and the first failure does not stop the later ones, so one run reports
// everything. Every step has a time limit; a step that exceeds it has its whole process tree
// killed and counts as a failure ("timed out"), so a hung test can never stall the gate.
//
// A program whose folder has no package.json yet is reported as not built, by name, never silently
// passed; every program that exists is checked (docs/07 section 5).
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const rootFlag = args.indexOf("--root");
const root =
  rootFlag === -1
    ? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")
    : path.resolve(args[rootFlag + 1] ?? ".");

const STEP_TIMEOUT_MS = 180_000;

const STEPS = [
  { name: "typecheck shared/media", cwd: "src/shared/media", cmd: "npm", args: ["run", "typecheck"] },
  { name: "typecheck backend", cwd: "src/backend", cmd: "npm", args: ["run", "typecheck"] },
  { name: "typecheck live-server", cwd: "src/live-server", cmd: "npm", args: ["run", "typecheck"] },
  { name: "typecheck fileserver", cwd: "src/fileserver", cmd: "npm", args: ["run", "typecheck"] },
  { name: "typecheck frontend", cwd: "src/frontend", cmd: "npm", args: ["run", "typecheck"] },
  { name: "lint frontend", cwd: "src/frontend", cmd: "npm", args: ["run", "lint"] },
  {
    name: "rules",
    cwd: ".",
    cmd: "node",
    args: ["scripts/check-rules.mjs"],
  },
  { name: "test checker", cwd: ".", cmd: "node", args: ["--test", "scripts/check-rules/test/*.test.mjs"] },
  { name: "test shared/media", cwd: "src/shared/media", cmd: "npm", args: ["test"] },
  { name: "test live-server", cwd: "src/live-server", cmd: "npm", args: ["test"] },
  { name: "test backend", cwd: "src/backend", cmd: "npm", args: ["test"] },
  { name: "test fileserver", cwd: "src/fileserver", cmd: "npm", args: ["test"] },
  { name: "test frontend", cwd: "src/frontend", cmd: "npm", args: ["test"] },
];

const PASSED_TESTS = /ℹ pass (\d+)/;

/** Run one step; resolve with its output, exit code and whether the limit was exceeded. */
function runStep(step) {
  return new Promise((resolve) => {
    const child = spawn(step.cmd, step.args, {
      cwd: path.join(root, step.cwd),
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      // Kill the whole tree: npm and tsx leave grandchildren that would keep the pipes open.
      if (process.platform === "win32") spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"]);
      else child.kill("SIGKILL");
    }, STEP_TIMEOUT_MS);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, output, timedOut });
    });
  });
}

let failed = 0;
let tests = 0;
const notBuilt = new Set();

for (const step of STEPS) {
  if (step.cwd !== "." && !existsSync(path.join(root, step.cwd, "package.json"))) {
    notBuilt.add(step.cwd);
    console.log(`${step.name.padEnd(22)} SKIP  (${step.cwd} not built yet)`);
    continue;
  }
  const started = Date.now();
  const run = await runStep(step);
  const seconds = Math.round((Date.now() - started) / 1000);
  const passed = Number(PASSED_TESTS.exec(run.output)?.[1] ?? 0);
  tests += passed;
  const ok = run.code === 0 && !run.timedOut;
  if (!ok) failed++;
  const detail = run.timedOut ? `TIMED OUT after ${STEP_TIMEOUT_MS / 1000}s` : `${seconds}s${passed ? `, ${passed} tests` : ""}`;
  console.log(`${step.name.padEnd(22)} ${ok ? "PASS" : "FAIL"}  (${detail})`);
  if (!ok) console.log(run.output.trim().split("\n").slice(-25).join("\n"));
}

console.log(failed === 0 ? `\ngate: PASS (${tests} tests passed)` : `\ngate: FAIL (${failed} step${failed === 1 ? "" : "s"})`);
if (notBuilt.size > 0) console.log(`not built yet: ${[...notBuilt].join(", ")}`);
console.log("still required (docs/07 section 6.5): the real checks against running programs");
process.exit(failed === 0 ? 0 : 1);
