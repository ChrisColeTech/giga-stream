import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { stripNoise } from "./strip-noise.mjs";

const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".cts", ".mjs"]);
// `data` is every program's runtime folder (databases, the live server's HLS segment cache, whose
// transport streams end in .ts); it is never source, and reading it exhausted the heap once.
const SKIPPED_DIRS = new Set(["node_modules", "dist", "out", "release", "public", ".git", "data"]);

/**
 * The programs, the shared libraries and the tools; a file belongs to the first root that contains it. The
 * nested libraries (`shared-ui`, `shared-http`) come before `shared`, which would otherwise walk them too (docs/27 section 2).
 */
const PROGRAM_ROOTS = [
  ["frontend", "src/frontend"],
  ["fileserver", "src/fileserver"],
  ["backend", "src/backend"],
  ["admin", "src/admin"],
  ["shared-ui", "src/shared/ui"],
  ["shared-http", "src/shared/http"],
  ["shared", "src/shared"],
  ["scripts", "scripts"],
];

function isTestFile(rel) {
  return /(^|\/)test\//.test(rel) || /\.test\.(ts|tsx|mjs)$/.test(rel);
}

function walk(dir, found) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIPPED_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, found);
    else if (CODE_EXTENSIONS.has(path.extname(entry.name))) found.push(full);
  }
}

/**
 * Every checked source file, read once. `code` is the text with comments blanked and strings kept
 * (route paths and SQL live in strings); `bare` also blanks string bodies (for `any`, `fetch(`).
 */
export function loadFiles(root, skippedPrograms = []) {
  const files = [];
  // A file is claimed by the first root that walks it, even a skipped one, so a nested skipped root never leaks into its parent.
  const claimed = new Set();
  for (const [program, rel] of PROGRAM_ROOTS) {
    const dir = path.join(root, rel);
    const found = [];
    try {
      walk(dir, found);
    } catch {
      continue; // a program that does not exist yet has nothing to check
    }
    if (skippedPrograms.includes(program)) {
      for (const abs of found) claimed.add(abs);
      continue;
    }
    for (const abs of found) {
      if (claimed.has(abs)) continue;
      claimed.add(abs);
      const relPath = path.relative(root, abs).split(path.sep).join("/");
      const text = readFileSync(abs, "utf-8");
      files.push({
        abs,
        rel: relPath,
        program,
        isTest: isTestFile(relPath),
        text,
        code: stripNoise(text, { strings: true }),
        bare: stripNoise(text, { strings: false }),
      });
    }
  }
  return files;
}

/** 1-based line number of a character offset. */
export function lineAt(text, offset) {
  let line = 1;
  for (let i = 0; i < offset; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}
