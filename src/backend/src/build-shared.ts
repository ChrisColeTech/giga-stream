import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

/**
 * Builds the shared media library into its own `dist` (docs/01 section 4.2), the way the fileserver does
 * (`src/fileserver/src/build-shared.ts`): the `.js` with esbuild, the one emitter that rewrites the library's
 * own `.ts` import specifiers (which `tsc` refuses, TS5097), and the `.d.ts` with tsc's declaration-only build.
 * The live engine imports `shared/media/dist` by a relative path whose depth is the same from `src/` and from
 * `dist/`, so one specifier serves the tsx lane and the built lane alike, and `dist/` keeps its layout
 * (`dist/server.js`). Every lane that loads the backend's source runs this first: `build`, `typecheck`,
 * `test` and `dev`. The library's tsconfig looks for `@types` in the fileserver's folder; this passes the
 * backend's own, so it builds with only the backend installed.
 *
 * Code splitting must stay OFF. With `splitting: true` esbuild hoists shared code (locate-tool.ts among it) into
 * a `chunk-*.js` at the root of `dist`, one folder shallower than the source. locate-tool computes REPO_ROOT
 * from its own `import.meta.url` with a fixed number of `..`, so a hoisted copy resolves the wrong root and
 * cannot find ffmpeg or ffprobe. Without splitting every module is bundled on its own and keeps its folder.
 *
 * The fileserver builds the same `dist`, and the dev stack starts both programs at once, so a `dist` that is
 * already newer than every source is left alone instead of being deleted under the other program's feet. A
 * `dist` holding any `chunk-*.js` was built by a splitting build and is never fresh: it is rebuilt here.
 */
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHARED = path.resolve(HERE, "..", "..", "shared", "media");
const SOURCE = path.join(SHARED, "src");
const DIST = path.join(SHARED, "dist");

function collect(folder: string, suffix: string, found: string[]): string[] {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) collect(full, suffix, found);
    else if (entry.name.endsWith(suffix)) found.push(full);
  }
  return found;
}

const entries = collect(SOURCE, ".ts", []);

function isFresh(): boolean {
  if (!existsSync(DIST)) return false;
  const built = [...collect(DIST, ".js", []), ...collect(DIST, ".d.ts", [])];
  if (built.length < entries.length * 2) return false;
  if (readdirSync(DIST).some((name) => /^chunk-.*\.js$/.test(name))) return false;
  const newestSource = Math.max(...entries.map((file) => statSync(file).mtimeMs));
  return Math.min(...built.map((file) => statSync(file).mtimeMs)) > newestSource;
}

if (isFresh()) {
  console.log("build-shared: up to date");
} else {
  rmSync(DIST, { recursive: true, force: true });
  await build({
    entryPoints: entries,
    outdir: DIST,
    outbase: SOURCE,
    bundle: true,
    splitting: false,
    format: "esm",
    platform: "node",
    target: "node24",
    packages: "external",
    tsconfig: path.join(SHARED, "tsconfig.json"),
    logLevel: "warning",
  });
  const tsc = path.resolve(HERE, "..", "node_modules", "typescript", "lib", "tsc.js");
  const typeRoots = path.resolve(HERE, "..", "node_modules", "@types");
  execFileSync(process.execPath, [tsc, "-p", path.join(SHARED, "tsconfig.build.json"), "--typeRoots", typeRoots], {
    stdio: "inherit",
  });
  console.log(`build-shared: ${entries.length} modules -> ${path.relative(process.cwd(), DIST)}`);
}
