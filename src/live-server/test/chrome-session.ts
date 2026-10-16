import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { killProcessTree } from "../src/stream/process-tree.ts";
import { pick } from "./test-app.ts";

const CHROME_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];

/** Awaits a condition: re-runs `check` until it returns something truthy or the deadline passes. */
export async function waitFor<T>(check: () => Promise<T>, { timeoutMs = 30000, intervalMs = 250, label = "condition" } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > deadline) throw new Error(`timed out after ${timeoutMs} ms waiting for ${label}`);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

function chromePath(): string {
  const found = [process.env.CHROME_PATH, ...CHROME_CANDIDATES].find((file) => file && existsSync(file));
  if (!found) throw new Error("set CHROME_PATH to a Chrome or Edge executable");
  return found;
}

export interface ChromeSession {
  navigate(url: string): Promise<unknown>;
  evaluate(expression: string): Promise<unknown>;
  close(): Promise<void>;
}

/** A muted headless Chrome driven over the DevTools protocol with Node's built-in WebSocket. */
export async function openChrome(): Promise<ChromeSession> {
  const profile = await mkdtemp(path.join(os.tmpdir(), "live-server-chrome-"));
  const chrome = spawn(
    chromePath(),
    [
      "--headless=new", "--mute-audio", "--no-first-run", "--disable-gpu", "--remote-debugging-port=0",
      `--user-data-dir=${profile}`, "--autoplay-policy=no-user-gesture-required", "about:blank",
    ],
    { stdio: "ignore", windowsHide: true },
  );
  const port = await waitFor(
    async () => (await readFile(path.join(profile, "DevToolsActivePort"), "utf-8").catch(() => "")).split("\n")[0],
    { label: "Chrome DevTools port" },
  );
  const targets: unknown = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = Array.isArray(targets) ? targets.find((target) => pick(target, "type") === "page") : undefined;
  const socket = new WebSocket(String(pick(page, "webSocketDebuggerUrl")));
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  let nextId = 0;
  socket.addEventListener("message", (event) => {
    const message: unknown = JSON.parse(String(event.data));
    const waiter = pending.get(Number(pick(message, "id")));
    if (!waiter) return;
    pending.delete(Number(pick(message, "id")));
    const error = pick(message, "error.message");
    if (error !== undefined) waiter.reject(new Error(String(error)));
    else waiter.resolve(pick(message, "result"));
  });
  const send = (method: string, params: Record<string, unknown> = {}) =>
    new Promise<unknown>((resolve, reject) => {
      nextId += 1;
      pending.set(nextId, { resolve, reject });
      socket.send(JSON.stringify({ id: nextId, method, params }));
    });
  return {
    navigate: (url) => send("Page.navigate", { url }),
    async evaluate(expression) {
      const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      const failure = pick(result, "exceptionDetails.text");
      if (failure !== undefined) throw new Error(String(failure));
      return pick(result, "result.value");
    },
    async close() {
      socket.close();
      await killProcessTree(chrome);
      await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    },
  };
}
