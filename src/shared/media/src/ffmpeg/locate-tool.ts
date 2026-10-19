import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { TOOLS_BIN_DIR, TOOLS_DIR_ENV } from "../constants/media.ts";
import type { LocateOptions, Tool } from "../types/tool.ts";

/** The root `package.json` name that marks the repository (the library's own is `@giga-stream/media`). */
const REPO_PACKAGE_NAME = "giga-stream";

function isRepoRoot(folder: string): boolean {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path.join(folder, "package.json"), "utf-8"));
    if (typeof parsed === "object" && parsed !== null && "name" in parsed && parsed.name === REPO_PACKAGE_NAME) {
      return true;
    }
  } catch {
    // no readable package.json here; try the tools folder
  }
  return existsSync(path.join(folder, ...TOOLS_BIN_DIR));
}

/**
 * The repository root, found by walking up from `start` to the first folder that is one: its `package.json` is
 * named `giga-stream`, or it holds this platform's FFmpeg payload. Independent of how deep the calling module sits, so the
 * source file, a built `dist/ffmpeg/` file and a bundler-hoisted chunk at the root of `dist` all agree.
 * Falls back to five folders above `start` (this file's depth in source) when nothing marks a root.
 */
export function findRepoRoot(start: string): string {
  let folder = path.resolve(start);
  for (;;) {
    if (isRepoRoot(folder)) return folder;
    const parent = path.dirname(folder);
    if (parent === folder) return path.resolve(start, "..", "..", "..", "..", "..");
    folder = parent;
  }
}

export const REPO_ROOT = findRepoRoot(path.dirname(fileURLToPath(import.meta.url)));

const executable = (tool: Tool): string => (process.platform === "win32" ? `${tool}.exe` : tool);

/**
 * A git worktree has no tools folder of its own (it is gitignored); its `.git` file points at the main
 * checkout, which does. Returns that checkout's root, or null when this is not a worktree.
 */
function mainCheckoutOf(root: string): string | null {
  try {
    const pointer = readFileSync(path.join(root, ".git"), "utf-8").match(/^gitdir:\s*(.+)$/m);
    if (!pointer?.[1]) return null;
    const common = path.resolve(root, pointer[1].trim(), "..", "..");
    return path.basename(common) === ".git" ? path.dirname(common) : null;
  } catch {
    return null;
  }
}

/**
 * The one path to a bundled tool (docs/09): the override folder, else the repository's platform payload, else the main
 * checkout's from a worktree. Never the PATH: another FFmpeg would have other capabilities. Throws, naming
 * every place tried, when it is nowhere.
 */
export function locateTool(tool: Tool, options: LocateOptions = {}): string {
  const { env = process.env, root = REPO_ROOT, exists = existsSync } = options;
  const dirs: string[] = [];
  const override = env[TOOLS_DIR_ENV];
  if (override) dirs.push(path.resolve(override));
  dirs.push(path.join(root, ...TOOLS_BIN_DIR));
  const main = mainCheckoutOf(root);
  if (main) dirs.push(path.join(main, ...TOOLS_BIN_DIR));
  const tried = dirs.map((dir) => path.join(dir, executable(tool)));
  const found = tried.find((candidate) => exists(candidate));
  if (!found) throw new Error(`${tool} not found; tried ${tried.join(", ")}`);
  return found;
}
