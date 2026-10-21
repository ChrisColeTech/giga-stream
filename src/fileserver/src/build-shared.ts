import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

/**
 * Builds the shared libraries into their own `dist` folders (docs/01 section 4.2): the `.js` with
 * esbuild — the one emitter that rewrites the libraries' own `.ts` import specifiers, which `tsc`
 * refuses (TS5097) — and the `.d.ts` with tsc's declaration-only build. The fileserver's sources
 * then import `shared/<library>/dist` by a relative path whose depth is the same from `src/` and
 * from `dist/`, so one specifier serves the tsx lane and the built Electron lane alike. Every lane
 * that loads the fileserver's source runs this first: `build`, `typecheck`, `test` and `dev:gateway`.
 *
 * The libraries are `media` and `watch`; each is built with the same options into its own `dist`,
 * and `watch` is the pure watch-entry semantics the fileserver shares with the interface (docs/61
 * section 2.5) — the interface reads its `src` through the `@giga/watch` alias, so only the
 * fileserver's lanes need this build.
 *
 * The MEDIA build here and `src/backend/src/build-shared.ts`'s must stay identical in what they
 * produce (same esbuild options, same declarations step), because the dev stack starts both programs
 * at once and whichever finishes last decides what is on disk; the backend builds only media (docs/61
 * section 2.5 puts watch in the fileserver and the interface). Code splitting must stay ON: without
 * it each entry bundles its OWN copy of any shared module, so module-level state (the scan registry
 * and its progress) is duplicated and diverges (scan-lifecycle fails). The hoisted `chunk-*.js` at
 * the root of each `dist` are expected; locate-tool does not depend on its depth. A `dist` newer
 * than every source is left alone instead of being deleted under the other program's feet.
 */
const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIBRARIES = ["media", "watch"].map((name) => path.resolve(HERE, "..", "..", "shared", name));
const tsc = path.resolve(HERE, "..", "node_modules", "typescript", "lib", "tsc.js");
const typeRoots = path.resolve(HERE, "..", "node_modules", "@types");

function collect(folder: string, suffix: string, found: string[]): string[] {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) collect(full, suffix, found);
    else if (entry.name.endsWith(suffix)) found.push(full);
  }
  return found;
}

async function buildLibrary(SHARED: string): Promise<void> {
  const SOURCE = path.join(SHARED, "src");
  const DIST = path.join(SHARED, "dist");
  const entries = collect(SOURCE, ".ts", []);

  function isFresh(): boolean {
    if (!existsSync(DIST)) return false;
    const built = [...collect(DIST, ".js", []), ...collect(DIST, ".d.ts", [])];
    if (built.length < entries.length * 2) return false;
    const newestSource = Math.max(...entries.map((file) => statSync(file).mtimeMs));
    return Math.min(...built.map((file) => statSync(file).mtimeMs)) > newestSource;
  }

  if (isFresh()) {
    console.log(`build-shared: ${path.basename(SHARED)} up to date`);
    return;
  }
  rmSync(DIST, { recursive: true, force: true });
  await build({
    entryPoints: entries,
    outdir: DIST,
    outbase: SOURCE,
    bundle: true,
    splitting: true,
    format: "esm",
    platform: "node",
    target: "node24",
    packages: "external",
    tsconfig: path.join(SHARED, "tsconfig.json"),
    logLevel: "warning",
  });
  execFileSync(process.execPath, [tsc, "-p", path.join(SHARED, "tsconfig.build.json"), "--typeRoots", typeRoots], {
    stdio: "inherit",
  });
  console.log(`build-shared: ${entries.length} ${path.basename(SHARED)} modules -> ${path.relative(process.cwd(), DIST)}`);
}

for (const library of LIBRARIES) await buildLibrary(library);
