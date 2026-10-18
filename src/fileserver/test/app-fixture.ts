import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import { after } from "node:test";

import { buildApp } from "../src/build-app.js";
import type { FolderScanner } from "../src/services/scan-service.js";
import { fakeScan } from "./fake-scan.js";

const PROGRAM_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BACKEND_ROOT = path.resolve(PROGRAM_ROOT, "..", "backend");

export const OWNER_USERNAME ="owner@example.test";
export const OWNER_PASSWORD = "owner-password-123";

/** Longest the fixture waits for the real backend to answer `/healthz`. */
const BACKEND_BOOT_MS = 30_000;

/** A clock tests move by hand; nothing sleeps (the Giga Images pattern). */
export function testClock(start = Date.UTC(2026, 9, 16, 12)) {
  let at = start;
  return { now: () => at, advance: (ms: number) => void (at += ms) };
}

export interface FileserverApp {
  app: FastifyInstance;
  dataDir: string;
  clock: ReturnType<typeof testClock>;
  dispose(): Promise<void>;
}

const apps: FileserverApp[] = [];
const backends: RealBackend[] = [];
after(async () => {
  for (const backend of backends) await backend.close();
  for (const created of apps) await created.dispose();
});

/** The real fileserver on a fresh temporary data folder, or on `options.dataDir` for restart tests. */
export async function makeApp(
  options: { dataDir?: string; probeFetch?: typeof fetch; webDist?: string; scan?: FolderScanner } = {},
): Promise<FileserverApp> {
  const dataDir = options.dataDir ?? mkdtempSync(path.join(os.tmpdir(), "giga-fileserver-test-"));
  const clock = testClock();
  const app = await buildApp({
    dataDir,
    now: clock.now,
    logger: false,
    ...(options.probeFetch !== undefined && { probeFetch: options.probeFetch }),
    ...(options.webDist !== undefined && { webDist: options.webDist }),
    // No test probes real files through the app: the stand-in scanner never spawns ffprobe (see fake-scan.ts).
    scan: options.scan ?? fakeScan,
  });
  const owned = options.dataDir === undefined;
  const created: FileserverApp = {
    app,
    dataDir,
    clock,
    async dispose() {
      await app.close();
      if (owned) rmSync(dataDir, { recursive: true, force: true });
    },
  };
  apps.push(created);
  return created;
}

export interface RealBackend {
  /** The base address the fileserver's `adminUrl` points at. */
  url: string;
  close(): Promise<void>;
}

/**
 * The real admin backend as a child process on 127.0.0.1: seeded channels, a bootstrap owner, a
 * temporary data folder. The fileserver talks to it exactly as in production — one HTTP request per
 * read, no shared state (docs/01 section 4.2's boundary kept by running, not importing).
 */
export async function startBackend(): Promise<RealBackend> {
  const port = await freePort();
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-backend-fixture-"));
  const child = spawn(
    process.execPath,
    [path.join(BACKEND_ROOT, "node_modules", "tsx", "dist", "cli.mjs"), "src/server.ts"],
    {
      cwd: BACKEND_ROOT,
      env: {
        ...process.env,
        NODE_ENV: "development",
        PORT: String(port),
        HOST: "127.0.0.1",
        DATA_DIR: dataDir,
        JWT_SECRET: "test-secret-that-is-at-least-32-characters",
        ADMIN_BOOTSTRAP_USERNAME: OWNER_USERNAME,
        ADMIN_BOOTSTRAP_PASSWORD: OWNER_PASSWORD,
        SEED_TEST_CHANNELS: "true",
        TMDB_READ_TOKEN: "",
        TMDB_SYNC_SCHEDULE: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  child.stderr.on("data", (chunk: Buffer) => process.stderr.write(`[backend] ${chunk.toString("utf-8")}`));

  const url = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + BACKEND_BOOT_MS;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`the backend exited early with ${child.exitCode}`);
    try {
      const response = await fetch(`${url}/healthz`);
      if (response.ok) break;
    } catch {
      // not listening yet
    }
    if (Date.now() > deadline) {
      killTree(child.pid);
      throw new Error("the backend did not answer /healthz in time");
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  const backend: RealBackend = {
    url,
    close: async () => {
      const exited = new Promise<void>((resolve) => {
        child.once("exit", () => resolve());
        setTimeout(resolve, 3_000).unref();
      });
      killTree(child.pid);
      await exited;
      try {
        rmSync(dataDir, { recursive: true, force: true });
      } catch {
        // best effort: a Windows handle can outlive the tree kill by a moment; the temp folder is the OS's
      }
    },
  };
  backends.push(backend);
  return backend;
}

/** A port nothing is listening on (bind, read the port, close). */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close(() => reject(new Error("no ephemeral port")));
        return;
      }
      const { port } = address;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

/** Kills the process and everything it spawned (Windows needs the tree kill). */
function killTree(pid: number | undefined): void {
  if (pid === undefined) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
  } else {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        /* already gone */
      }
    }
  }
}

export interface Answer {
  status: number;
  body: unknown;
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export async function send(
  app: FastifyInstance,
  method: Method,
  url: string,
  body?: unknown,
): Promise<Answer> {
  const reply = await app.inject({
    method,
    url,
    headers: body !== undefined ? { "content-type": "application/json" } : {},
    ...(body !== undefined && { payload: JSON.stringify(body) }),
  });
  return { status: reply.statusCode, body: reply.body === "" ? null : JSON.parse(reply.body) };
}

/** Reads `a.b.0.c` out of parsed JSON; undefined when any step is missing. */
export function pick(value: unknown, dotted: string): unknown {
  let current: unknown = value;
  for (const step of dotted.split(".")) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[step];
  }
  return current;
}

/** A sign-in against the real backend and the session's access token. */
export async function backendToken(backendUrl: string): Promise<string> {
  const response = await fetch(`${backendUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: OWNER_USERNAME, password: OWNER_PASSWORD }),
  });
  const answer = (await response.json()) as { data?: { accessToken?: string } };
  if (answer.data?.accessToken === undefined) throw new Error("the fixture backend would not sign in");
  return answer.data.accessToken;
}

/** Points the fileserver's `adminUrl` setting at an address (`03` section 3.2). */
export async function pointAt(app: FileserverApp, backendUrl: string): Promise<void> {
  await send(app.app, "PATCH", "/api/settings", { adminUrl: backendUrl });
}
