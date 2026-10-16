import { spawn } from "node:child_process";

import { STDERR_TAIL_CHARS } from "../constants/media.ts";
import type { RunOptions, RunResult } from "../types/tool.ts";

/** A tool that exited non-zero: its exit code and the tail of what it said. */
export class ToolError extends Error {
  readonly exitCode: number | null;
  readonly stderr: string;

  constructor(tool: string, exitCode: number | null, stderr: string) {
    super(`${tool} exited ${exitCode ?? "without a code"}: ${stderr.trim().slice(-600)}`);
    this.name = "ToolError";
    this.exitCode = exitCode;
    this.stderr = stderr;
  }
}

/**
 * Runs a tool to completion and answers what it wrote. Rejects with a `ToolError` on a non-zero exit, and
 * with the signal's reason when aborted (the process is killed first). It never inherits a terminal, so
 * nothing waits on a prompt.
 */
export function runTool(toolPath: string, args: readonly string[], options: RunOptions = {}): Promise<RunResult> {
  const { cwd, signal, captureStdout = false } = options;
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const proc = spawn(toolPath, args, {
      cwd,
      stdio: ["ignore", captureStdout ? "pipe" : "ignore", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf-8");
    });
    proc.stderr?.on("data", (chunk: Buffer) => {
      stderr = (stderr + chunk.toString("utf-8")).slice(-STDERR_TAIL_CHARS);
    });
    const onAbort = (): void => {
      proc.kill();
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    proc.on("error", (error) => {
      signal?.removeEventListener("abort", onAbort);
      reject(error);
    });
    proc.on("close", (code) => {
      signal?.removeEventListener("abort", onAbort);
      if (signal?.aborted) reject(signal.reason);
      else if (code === 0) resolve({ stdout, stderr });
      else reject(new ToolError(toolPath, code, stderr));
    });
  });
}
