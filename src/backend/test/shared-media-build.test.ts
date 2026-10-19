// Regression: the built shared media library (split into chunks) still finds the repository root and the bundled
// tools, wherever esbuild put locate-tool (its root no longer depends on the file's depth).
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { locateTool, REPO_ROOT } from "../../shared/media/dist/ffmpeg/locate-tool.js";

const here = path.dirname(fileURLToPath(import.meta.url));
/** Windows paths differ only by case between sources; compare them the same way everywhere. */
const fold = (p: string): string => (process.platform === "win32" ? path.resolve(p).toLowerCase() : path.resolve(p));

test("the built locate-tool resolves the repository root", () => {
  assert.equal(fold(REPO_ROOT), fold(path.resolve(here, "..", "..", "..")));
});

test("the built locate-tool finds ffprobe in the tools folder without requiring a local binary", () => {
  const executable = process.platform === "win32" ? "ffprobe.exe" : "ffprobe";
  const expected = path.join(REPO_ROOT, "tools", "ffmpeg", "bin", executable);
  const found = locateTool("ffprobe", { env: {}, exists: (candidate) => fold(candidate) === fold(expected) });
  assert.equal(fold(found), fold(expected));
});
