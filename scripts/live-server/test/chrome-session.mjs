import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { killProcessTree } from "../process-tree.mjs";

const CHROME_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];

/** Awaits a condition: re-runs `check` until it returns something truthy or the deadline passes. */
export async function waitFor(check, { timeoutMs = 30000, intervalMs = 250, label = "condition" } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > deadline) throw new Error(`timed out after ${timeoutMs} ms waiting for ${label}`);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

function chromePath() {
  const found = [process.env.CHROME_PATH, ...CHROME_CANDIDATES].find((file) => file && existsSync(file));
  if (!found) throw new Error("set CHROME_PATH to a Chrome or Edge executable");
  return found;
}

/**
 * A muted headless Chrome driven over the DevTools protocol with Node's built-in WebSocket.
 * Returns { navigate(url), evaluate(expression), close() }.
 */
export async function openChrome() {
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
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const socket = new WebSocket(targets.find((target) => target.type === "page").webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  const pending = new Map();
  let nextId = 0;
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(message.error.message));
    else waiter.resolve(message.result);
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      nextId += 1;
      pending.set(nextId, { resolve, reject });
      socket.send(JSON.stringify({ id: nextId, method, params }));
    });
  return {
    navigate: (url) => send("Page.navigate", { url }),
    async evaluate(expression) {
      const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
      return result.result.value;
    },
    async close() {
      socket.close();
      await killProcessTree(chrome);
      await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    },
  };
}
