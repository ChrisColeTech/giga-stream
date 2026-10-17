import { type ChildProcess, spawn } from "node:child_process";

/** True while the child process is still running. */
export function isRunning(child: ChildProcess | null): child is ChildProcess {
  return child !== null && child.exitCode === null && child.signalCode === null;
}

/**
 * Kills a child and everything it started. Windows has no process groups to signal, so taskkill walks
 * the tree (/T) by its pid and forces it (/F); elsewhere ffmpeg has no children and SIGKILL is enough.
 * Resolves when the kill command has finished; the caller waits for the child's own exit event.
 */
export function killProcessTree(child: ChildProcess | null): Promise<void> {
  if (!isRunning(child) || child.pid === undefined) return Promise.resolve();
  if (process.platform !== "win32") {
    child.kill("SIGKILL");
    return Promise.resolve();
  }
  const pid = child.pid;
  return new Promise((resolve) => {
    const killer = spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    killer.on("error", () => {
      child.kill("SIGKILL");
      resolve();
    });
    killer.on("close", () => resolve());
  });
}
