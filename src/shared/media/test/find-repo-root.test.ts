// The repository root is found by walking up to a marker, so it does not depend on how deep the module sits.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after } from "node:test";

import { TOOLS_BIN_DIR } from "../src/constants/media.ts";
import { findRepoRoot, locateTool } from "../src/ffmpeg/locate-tool.ts";

const sandbox = mkdtempSync(path.join(tmpdir(), "giga-locator-"));
after(() => rmSync(sandbox, { recursive: true, force: true }));

/** A repository-shaped folder: root package.json plus the library's own nested package.json. */
function makeRepo(name: string): string {
  const root = path.join(sandbox, name);
  const media = path.join(root, "src", "shared", "media");
  for (const sub of ["src/ffmpeg", "dist/ffmpeg"]) mkdirSync(path.join(media, sub), { recursive: true });
  writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "giga-stream" }));
  writeFileSync(path.join(media, "package.json"), JSON.stringify({ name: "@giga-stream/media" }));
  return root;
}

test("source, dist/ffmpeg and a chunk at the dist root all resolve to the same repository root", () => {
  const root = makeRepo("main");
  const media = path.join(root, "src", "shared", "media");
  for (const start of [path.join(media, "src", "ffmpeg"), path.join(media, "dist", "ffmpeg"), path.join(media, "dist")]) {
    assert.equal(findRepoRoot(start), root, start);
  }
});

test("a git worktree resolves to its own root, and the tools of the main checkout are still reached", () => {
  const main = makeRepo("checkout");
  const tree = makeRepo("worktree");
  writeFileSync(path.join(tree, ".git"), `gitdir: ${path.join(main, ".git", "worktrees", "tree")}\n`);
  mkdirSync(path.join(main, ...TOOLS_BIN_DIR), { recursive: true });
  const wanted = path.join(main, ...TOOLS_BIN_DIR, process.platform === "win32" ? "ffprobe.exe" : "ffprobe");
  assert.equal(findRepoRoot(path.join(tree, "src", "shared", "media", "dist")), tree);
  assert.equal(locateTool("ffprobe", { env: {}, root: tree, exists: (file) => file === wanted }), wanted);
});

test("a folder holding the platform tools counts as a root when no package.json names the repository", () => {
  const root = path.join(sandbox, "bare");
  mkdirSync(path.join(root, ...TOOLS_BIN_DIR), { recursive: true });
  mkdirSync(path.join(root, "deep", "er"), { recursive: true });
  assert.equal(findRepoRoot(path.join(root, "deep", "er")), root);
});
