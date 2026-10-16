import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { TOOLS_BIN_DIR, TOOLS_DIR_ENV } from "../constants/media.ts";
import type { LocateOptions, Tool } from "../types/tool.ts";

/** The repository root: this file is `src/shared/media/src/ffmpeg/locate-tool.ts`. */
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..");

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
 * The one path to a bundled tool (docs/09): the override folder, else `<repo>/tools/ffmpeg/bin`, else the main
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
