import { spawn as nodeSpawn } from "node:child_process";

/** True while the child process is still running. */
export function isRunning(child) {
  return child !== null && child !== undefined && child.exitCode === null && child.signalCode === null;
}

/**
 * Kills a child and everything it started. Windows has no process groups to signal, so taskkill
 * walks the tree (/T) and forces it (/F); elsewhere ffmpeg has no children and SIGKILL is enough.
 * Resolves when the kill command has finished; the caller waits for the child's own exit event.
 */
export function killProcessTree(child, { platform = process.platform, spawn = nodeSpawn } = {}) {
  if (!isRunning(child) || child.pid === undefined) return Promise.resolve();
  if (platform !== "win32") {
    child.kill("SIGKILL");
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    killer.on("error", () => {
      child.kill("SIGKILL");
      resolve();
    });
    killer.on("close", () => resolve());
  });
}
