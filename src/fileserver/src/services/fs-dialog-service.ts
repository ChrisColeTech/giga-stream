import { randomBytes } from "node:crypto";
import { stat } from "node:fs/promises";
import path from "node:path";

import { SELECTION_TOKEN_BYTES, SELECTION_TOKEN_TTL_MS } from "../constants/media-files.js";
import { AppError } from "../lib/app-error.js";

const desktopRequired = (): AppError =>
  new AppError("fs.desktop_required", 409, "Choosing a folder needs the desktop app.");

const cancelled = (): AppError => new AppError("fs.cancelled", 409, "No folder was chosen.");

const invalidSelection = (): AppError =>
  new AppError("fs.invalid_selection", 422, "That folder cannot be selected.");

export interface FolderSelection {
  token: string;
  /** The folder's own name — the basename — never its path (docs/03 section 3.8). */
  name: string;
}

/**
 * The folder-selection lane (docs/03 section 3.8): Electron runs the native picker through the seam
 * `build-app` injects (nothing else may import Electron); with `TEST_FOLDER_ROOT` the request body's
 * `{ name }` picks directly under that root so a browser test can choose one. A token is in-memory
 * only, single-use, dies after ten minutes, and stands for exactly one folder path (never a path it
 * carries back out).
 */
export interface FsDialogService {
  /** Mints a token for the chosen folder; `422 fs.invalid_selection` when the body's name misses. */
  selectFolder: (name: unknown) => Promise<FolderSelection>;
  /** Redeems a token for its absolute path, then kills it; invalid, used, expired or moved is 422. */
  redeem: (token: string) => Promise<string>;
}

export function createFsDialogService(deps: {
  runtime: "electron" | "browser";
  openFolderPicker?: () => Promise<{ path: string } | "cancelled">;
  testFolderRoot: string;
  now: () => number;
}): FsDialogService {
  const pending = new Map<string, { path: string; expiresAt: number }>();

  function prune(): void {
    const at = deps.now();
    for (const [token, selection] of pending) if (selection.expiresAt < at) pending.delete(token);
  }

  async function assertDirectory(folder: string): Promise<void> {
    const info = await stat(folder).catch(() => undefined);
    if (info === undefined || !info.isDirectory()) throw invalidSelection();
  }

  async function mint(folder: string): Promise<FolderSelection> {
    await assertDirectory(folder);
    const token = randomBytes(SELECTION_TOKEN_BYTES).toString("hex");
    pending.set(token, { path: folder, expiresAt: deps.now() + SELECTION_TOKEN_TTL_MS });
    return { token, name: path.basename(folder) || "Folder" };
  }

  async function resolvedUnderRoot(relative: string): Promise<string> {
    const root = path.resolve(deps.testFolderRoot);
    const target = path.resolve(root, relative);
    if (target !== root && !target.startsWith(root + path.sep)) throw invalidSelection();
    return target;
  }

  return {
    async selectFolder(name) {
      if (deps.testFolderRoot !== "") {
        if (typeof name !== "string" || name === "") throw invalidSelection();
        return mint(await resolvedUnderRoot(name));
      }
      if (deps.runtime !== "electron" || deps.openFolderPicker === undefined) throw desktopRequired();
      const chosen = await deps.openFolderPicker();
      if (chosen === "cancelled") throw cancelled();
      return mint(chosen.path);
    },

    async redeem(token) {
      prune();
      const selection = pending.get(token);
      pending.delete(token);
      if (selection === undefined) throw invalidSelection();
      await assertDirectory(selection.path);
      return selection.path;
    },
  };
}
