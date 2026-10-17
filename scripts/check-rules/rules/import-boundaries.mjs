import path from "node:path";

import { lineAt } from "../load-files.mjs";

const SPECIFIER = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)["']([^"']+)["']/g;

const PROGRAM_DIRS = {
  frontend: "src/frontend",
  fileserver: "src/fileserver",
  backend: "src/backend",
  admin: "src/admin",
};

/** The shared libraries: `shared` (the media library), the family UI library and the request layer (docs/27 section 2). */
const SHARED_PROGRAMS = new Set(["shared", "shared-ui", "shared-http"]);
/** Programs that consume the family library by its `@giga/ui` / `@giga/http` alias, never by a relative path (docs/27 section 3). */
const CONSUMERS = new Set(["frontend", "admin"]);
const LIBRARY_DIRS = ["src/shared/ui/", "src/shared/http/"];

function programOf(rel) {
  for (const [program, dir] of Object.entries(PROGRAM_DIRS)) if (rel.startsWith(dir + "/")) return program;
  return null;
}

/** Electron imports are confined to the fileserver's app folder (`01` section 4.2). */
const ELECTRON_HOMES = ["src/fileserver/src/app/", "src/backend/src/app/"];

const IO_IN_ROUTES = /^(node:)?(fs|fs\/promises|child_process|sqlite|net|http|https)$/;

function inRoutes(file) {
  return /^src\/fileserver\/src\/routes\//.test(file.rel) || /^src\/backend\/src\/api\//.test(file.rel);
}

export const importBoundaries = {
  id: "import-boundaries",
  check(files) {
    const findings = [];
    for (const file of files) {
      if (file.program === "scripts") continue; // the rule is about the programs and the shared libraries
      const own = programOf(file.rel);
      for (const match of file.code.matchAll(SPECIFIER)) {
        const specifier = match[1];
        const line = lineAt(file.code, match.index);
        const at = (message) => findings.push({ file: file.rel, line, message });
        const target = specifier.startsWith(".")
          ? path.posix.normalize(path.posix.join(path.posix.dirname(file.rel), specifier))
          : null;

        if (target && own) {
          const other = programOf(target);
          if (other && other !== own) at(`imports ${other} source (${specifier}); programs talk over HTTP/WS only`);
        }
        // A shared library is imported by programs and tools; it never imports one (01 section 4.2).
        if (target && SHARED_PROGRAMS.has(file.program) && !file.isTest) {
          if (programOf(target) || target.startsWith("scripts/")) at(`a shared library may not import ${specifier}`);
        }
        if (target && CONSUMERS.has(file.program) && LIBRARY_DIRS.some((dir) => target.startsWith(dir))) {
          at(`import the family library by its @giga/ui or @giga/http alias, not ${specifier}`);
        }
        if (file.program === "shared-http" && /^react(-dom)?(\/|$)/.test(specifier)) {
          at("the request layer is React-free (docs/27 section 4.1)");
        }
        if (specifier === "electron" && !ELECTRON_HOMES.some((home) => file.rel.startsWith(home))) {
          at("electron may be imported only under src/fileserver/src/app");
        }
        if ((specifier === "node:sqlite" || specifier === "sqlite") && !file.isTest) {
          if (!/\/store\//.test(file.rel)) at("node:sqlite belongs under a store/ folder");
        }
        if (!file.isTest && inRoutes(file) && IO_IN_ROUTES.test(specifier)) {
          at(`routes parse, make one service call and answer; ${specifier} belongs in a service or store`);
        }
        if (!file.isTest && inRoutes(file) && /\/store\//.test(specifier)) {
          at("routes call one service; they do not reach the store directly (01 section 4.3)");
        }
        if (file.program === "frontend" && /\/(fileserver|backend)\b/.test(specifier) && !specifier.startsWith("@/")) {
          at("the renderer never imports fileserver or backend source");
        }
      }
    }
    return findings;
  },
};
