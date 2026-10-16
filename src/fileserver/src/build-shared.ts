import { execFileSync } from "node:child_process";
import { readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

/**
 * Builds the shared media library into its own `dist` (docs/01 section 4.2): the `.js` with esbuild
 * — the one emitter that rewrites the library's own `.ts` import specifiers, which `tsc` refuses
 * (TS5097) — and the `.d.ts` with tsc's declaration-only build. The fileserver's sources then import
 * `shared/media/dist` by a relative path whose depth is the same from `src/` and from `dist/`, so
 * one specifier serves the tsx lane and the built Electron lane alike. Every lane that loads the
 * fileserver's source runs this first: `build`, `typecheck`, `test` and `dev:gateway`.
 */
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHARED = path.resolve(HERE, "..", "..", "shared", "media");
const SOURCE = path.join(SHARED, "src");
const DIST = path.join(SHARED, "dist");

function collect(folder: string, found: string[]): void {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) collect(full, found);
    else if (entry.name.endsWith(".ts")) found.push(full);
  }
}

const entries: string[] = [];
collect(SOURCE, entries);
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

execFileSync(process.execPath, [path.resolve(HERE, "..", "node_modules", "typescript", "lib", "tsc.js"), "-p", path.join(SHARED, "tsconfig.build.json")], {
  stdio: "inherit",
});

console.log(`build-shared: ${entries.length} modules -> ${path.relative(process.cwd(), DIST)}`);
