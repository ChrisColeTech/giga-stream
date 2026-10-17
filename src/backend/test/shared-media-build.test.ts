// Regression: the built shared media library keeps every module at its source depth, so locate-tool's
// import.meta.url-relative REPO_ROOT finds the repository's tools folder (a split build put it one folder short).
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { REPO_ROOT } from "../../shared/media/dist/ffmpeg/locate-tool.js";

const here = path.dirname(fileURLToPath(import.meta.url));
/** Windows paths differ only by case between sources; compare them the same way everywhere. */
const same = (a: string, b: string): string[] =>
  [a, b].map((p) => (process.platform === "win32" ? path.resolve(p).toLowerCase() : path.resolve(p)));

test("the built locate-tool resolves the repository root from its own folder", () => {
  const [actual, expected] = same(REPO_ROOT, path.resolve(here, "..", "..", ".."));
  assert.equal(actual, expected);
});

test("the built library has no shared chunks at the root of its dist", () => {
  const dist = path.resolve(here, "..", "..", "shared", "media", "dist");
  assert.deepEqual(readdirSync(dist).filter((name) => /^chunk-.*\.js$/.test(name)), []);
});
