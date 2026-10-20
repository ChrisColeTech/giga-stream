import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import type { Client } from "@libsql/client";
import { after } from "node:test";

import { buildApp } from "../src/build-app.js";
import type { FolderScanner } from "../src/services/scan-service.js";
import { fakeScan } from "./fake-scan.js";
import { makeAdminDatabase } from "./admin-database.js";

/** A clock tests move by hand; nothing sleeps (the Giga Images pattern). */
export function testClock(start = Date.UTC(2026, 9, 16, 12)) {
  let at = start;
  return { now: () => at, advance: (ms: number) => void (at += ms) };
}

export interface FileserverApp {
  app: FastifyInstance;
  dataDir: string;
  clock: ReturnType<typeof testClock>;
  adminDatabase: Client;
  dispose(): Promise<void>;
}

const apps: FileserverApp[] = [];
after(async () => {
  for (const created of apps) await created.dispose();
});

/**
 * The real fileserver on a fresh temporary data folder, or on `options.dataDir` for restart tests. The backend
 * cache does not sync at launch (`syncOnStart` false) unless a test asks; `adminFetch` injects the backend.
 */
export async function makeApp(
  options: {
    dataDir?: string;
    adminFetch?: typeof fetch;
    syncOnStart?: boolean;
    clock?: ReturnType<typeof testClock>;
    webDist?: string;
    scan?: FolderScanner;
    /** The admin backend the reverse proxy points at (test/admin-proxy.test.ts); unset leaves it off. */
    adminProxyTarget?: string;
    adminDatabase?: Client;
  } = {},
): Promise<FileserverApp> {
  const dataDir = options.dataDir ?? mkdtempSync(path.join(os.tmpdir(), "giga-fileserver-test-"));
  const clock = options.clock ?? testClock();
  const adminDatabase = options.adminDatabase ?? await makeAdminDatabase();
  const app = await buildApp({
    dataDir,
    now: clock.now,
    logger: false,
    syncOnStart: options.syncOnStart ?? false,
    ...(options.adminFetch !== undefined && { adminFetch: options.adminFetch }),
    ...(options.webDist !== undefined && { webDist: options.webDist }),
    ...(options.adminProxyTarget !== undefined && { adminMediaTarget: options.adminProxyTarget }),
    adminDatabase,
    jwtSecret: "test-secret-that-is-at-least-32-characters",
    // No test probes real files through the app: the stand-in scanner never spawns ffprobe (see fake-scan.ts).
    scan: options.scan ?? fakeScan,
  });
  const owned = options.dataDir === undefined;
  const created: FileserverApp = {
    app,
    dataDir,
    clock,
    adminDatabase,
    async dispose() {
      await app.close();
      if (owned) rmSync(dataDir, { recursive: true, force: true });
    },
  };
  apps.push(created);
  return created;
}

export interface Answer {
  status: number;
  body: unknown;
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

/** One injected call; the default headers carry the desktop page's runtime marker (docs/63 section 3.2), so the
 *  standing suite speaks Electron. A test that wants a browser call injects its own headers instead. */
export async function send(app: FastifyInstance, method: Method, url: string, body?: unknown): Promise<Answer> {
  const reply = await app.inject({
    method,
    url,
    headers: { "x-giga-runtime": "electron", ...(body !== undefined && { "content-type": "application/json" }) },
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
