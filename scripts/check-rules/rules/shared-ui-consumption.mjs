import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * docs/27 section 3: every app that consumes the family library (`src/shared/ui`) by source alias must carry the
 * alias, the Tailwind `@source`, the `dedupe` list and the `fs.allow` that let the library's files load, and must pin
 * the packages both sides share to the same versions. Runs only where the library exists; the apps are read from disk
 * because their config files are not source (they are not in the loaded file list).
 */
const LIBRARY = "src/shared/ui";
const CONSUMERS = ["src/frontend", "src/admin"];
const ALIASES = ["@giga/ui", "@giga/http"];
const DEDUPE = ["react", "react-dom", "framer-motion", "zustand", "lucide-react"];
const SHARED_PINS = ["react", "react-dom", "framer-motion", "lucide-react", "zustand", "zod", "@radix-ui/react-dropdown-menu"];

function readText(root, rel) {
  try {
    return readFileSync(path.join(root, rel), "utf-8");
  } catch {
    return null;
  }
}

function readJson(root, rel) {
  const text = readText(root, rel);
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** The consumer's Vite config: each alias, the dedupe list and fs.allow. */
function viteProblems(vite) {
  const problems = [];
  for (const alias of ALIASES) {
    if (!new RegExp(`['"]${alias}['"]\\s*:`).test(vite)) problems.push(`no resolve.alias for ${alias}`);
  }
  const dedupe = /dedupe:\s*\[([^\]]*)\]/.exec(vite);
  if (dedupe === null) {
    problems.push("no resolve.dedupe");
  } else {
    for (const name of DEDUPE) {
      if (!new RegExp(`['"]${name}['"]`).test(dedupe[1])) problems.push(`resolve.dedupe lacks ${name}`);
    }
  }
  if (!/fs:\s*\{\s*allow:/.test(vite)) problems.push("no server.fs.allow (the library sits outside the app root)");
  return problems;
}

/** The consumer's stylesheet entry scans the library's classes, and its tsconfig maps the two alias paths. */
function sourceAndPathProblems(css, tsconfig) {
  const problems = [];
  if (!/@source\s+["']\.\.\/\.\.\/shared\/ui\/src["']/.test(css)) problems.push("index.css has no @source ../../shared/ui/src");
  for (const alias of ALIASES) {
    if (!tsconfig.includes(`"${alias}/*"`)) problems.push(`tsconfig.app.json paths has no ${alias}/*`);
  }
  return problems;
}

/** One version for each package both sides declare, and the library declares the runtime. */
function pinProblems(consumerPkg, libraryPkg) {
  const problems = [];
  const mine = consumerPkg.dependencies ?? {};
  const theirs = libraryPkg.dependencies ?? {};
  for (const name of ["react", "react-dom"]) {
    if (theirs[name] === undefined) problems.push(`the library does not declare ${name}`);
  }
  for (const name of SHARED_PINS) {
    if (mine[name] !== undefined && theirs[name] !== undefined && mine[name] !== theirs[name]) {
      problems.push(`${name} is ${mine[name]} here but ${theirs[name]} in the library`);
    }
  }
  return problems;
}

export const sharedUiConsumption = {
  id: "shared-ui-consumption",
  check(_files, { root }) {
    const libraryPkg = readJson(root, `${LIBRARY}/package.json`);
    if (libraryPkg === null) return []; // no library in this tree: nothing consumes it
    const findings = [];
    for (const dir of CONSUMERS) {
      const add = (message) => findings.push({ file: dir, message });
      const vite = readText(root, `${dir}/vite.config.mts`);
      const css = readText(root, `${dir}/src/index.css`) ?? "";
      const tsconfig = readText(root, `${dir}/tsconfig.app.json`) ?? "";
      const pkg = readJson(root, `${dir}/package.json`);
      if (vite === null) add("no vite.config.mts");
      else for (const problem of viteProblems(vite)) add(problem);
      for (const problem of sourceAndPathProblems(css, tsconfig)) add(problem);
      if (pkg === null) add("no package.json");
      else for (const problem of pinProblems(pkg, libraryPkg)) add(problem);
    }
    return findings;
  },
};
