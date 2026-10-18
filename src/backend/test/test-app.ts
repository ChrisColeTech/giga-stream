import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after } from "node:test";
import type { FastifyInstance } from "fastify";

import { buildApp } from "../src/app.js";
import type { Config } from "../src/config.js";
import type { LiveEngine, LiveSeams } from "../src/live/engine/live-engine.js";
import { SafeFetchError, type SafeFetch } from "../src/services/safe-fetch.js";
import { fakeBuild, type FakeTally } from "./live-fake-source.js";

export const ADMIN_USERNAME ="admin@example.test";
export const ADMIN_PASSWORD = "admin-password-123";
export const JWT_SECRET = "test-secret-that-is-at-least-32-characters";

/** A clock tests move by hand; nothing sleeps. */
export function testClock(start = Date.UTC(2026, 9, 16, 12)) {
  let at = start;
  return { now: () => at, advance: (ms: number) => void (at += ms) };
}

export interface TestApp {
  app: FastifyInstance;
  dataDir: string;
  clock: ReturnType<typeof testClock>;
  /** The live engine, to wait for the builds in progress (`live.settled()`) or read a channel's state. */
  live: LiveEngine;
  /** What the fake build made and stopped, and the delays the slow-segments fault asked to sleep. */
  tally: FakeTally;
  sleeps: number[];
  dispose(): Promise<void>;
}

export interface MakeAppOptions {
  seed?: boolean;
  dataDir?: string;
  config?: Partial<Config>;
  /** The guarded outbound fetch for playlist addresses (docs/43 section 3.8): tests inject a fake, never the network. */
  safeFetch?: SafeFetch;
  /** `real` runs the real build (ffprobe, ffmpeg); the default is a fake source, so no program runs. */
  engine?: "fake" | "real";
  live?: LiveSeams;
  /** Replaces the hand-moved clock (the opt-in browser tests need real time). */
  now?: () => number;
}

const created: TestApp[] = [];

/** The default outbound fetch of a test app: nothing is reachable, so no test touches the network by accident. */
const offlineSafeFetch: SafeFetch = async () => {
  throw new SafeFetchError("safe_fetch.failed");
};

/** A fresh app on a fresh temporary data folder, with the bootstrap admin: no shared state, no network. */
export async function makeApp(options: MakeAppOptions = {}): Promise<TestApp> {
  const dataDir = options.dataDir ?? mkdtempSync(path.join(os.tmpdir(), "giga-backend-test-"));
  const clock = testClock();
  const now = options.now ?? clock.now;
  const tally: FakeTally = { built: 0, stopped: 0 };
  const sleeps: number[] = [];
  let engine: LiveEngine | undefined;
  const seams: LiveSeams = {
    ...(options.engine === "real" ? {} : { build: fakeBuild(now, tally), sleep: async (ms: number) => void sleeps.push(ms) }),
    ...options.live,
    onEngine: (made) => {
      engine = made;
      options.live?.onEngine?.(made);
    },
  };
  const app = await buildApp(
    {
      NODE_ENV: "test",
      HOST: "127.0.0.1",
      DATA_DIR: dataDir,
      // Never the environment's: everything the live engine writes stays inside the temporary data folder.
      CACHE_DIR: path.join(dataDir, "cache"),
      FIXTURE_DIR: path.join(dataDir, "fixtures"),
      ADMIN_DIST: path.join(dataDir, "admin-dist"),
      TEST_PAGE: false,
      JWT_SECRET,
      ADMIN_BOOTSTRAP_USERNAME: ADMIN_USERNAME,
      ADMIN_BOOTSTRAP_EMAIL: "",
      ADMIN_BOOTSTRAP_PASSWORD: ADMIN_PASSWORD,
      TLS_CERT_FILE: "",
      TLS_KEY_FILE: "",
      TRUST_PROXY: false,
      ALLOW_INSECURE_HTTP: false,
      CORS_ORIGINS: "",
      TMDB_READ_TOKEN: "",
      TMDB_MIN_GAP_MS: 0,
      SEED_TEST_CHANNELS: options.seed ?? false,
      ...options.config,
    },
    now,
    options.safeFetch ?? offlineSafeFetch,
    seams,
  );
  if (engine === undefined) throw new Error("the live engine was not created");
  let disposed = false;
  const testApp: TestApp = {
    app,
    dataDir,
    clock,
    live: engine,
    tally,
    sleeps,
    async dispose() {
      if (disposed) return;
      disposed = true;
      await app.close();
      if (!options.dataDir) rmSync(dataDir, { recursive: true, force: true });
    },
  };
  created.push(testApp);
  return testApp;
}

after(async () => {
  for (const testApp of created) await testApp.dispose();
});

export interface Answer {
  status: number;
  body: unknown;
  headers: Record<string, unknown>;
  /** The bytes, for playlists, segments and pages. */
  raw: Buffer;
}

type Method = "GET" | "HEAD" | "POST" | "PATCH" | "PUT" | "DELETE" | "OPTIONS";

export interface RequestOptions {
  method: Method;
  url: string;
  body?: unknown;
  token?: string;
  headers?: Record<string, string>;
  address?: string;
}

/** One request through Fastify's injector, as a peer at `address` (default this computer). */
export async function request(app: FastifyInstance, options: RequestOptions): Promise<Answer> {
  const headers: Record<string, string> = { ...options.headers };
  if (options.token !== undefined) headers.authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers["content-type"] = "application/json";
  const reply = await app.inject({
    method: options.method,
    url: options.url,
    headers,
    remoteAddress: options.address ?? "127.0.0.1",
    ...(options.body !== undefined && { payload: JSON.stringify(options.body) }),
  });
  const json = String(reply.headers["content-type"] ?? "").startsWith("application/json");
  return {
    status: reply.statusCode,
    body: json && reply.body !== "" ? JSON.parse(reply.body) : null,
    headers: reply.headers,
    raw: reply.rawPayload,
  };
}

export function send(
  app: FastifyInstance,
  method: Method,
  url: string,
  body?: unknown,
  token?: string,
  address = "127.0.0.1",
): Promise<Answer> {
  return request(app, { method, url, address, ...(body !== undefined && { body }), ...(token !== undefined && { token }) });
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

/** Signs in and answers the session's two tokens. */
export async function signIn(app: FastifyInstance, username = ADMIN_USERNAME, password = ADMIN_PASSWORD) {
  const answer = await send(app, "POST", "/api/auth/login", { username, password });
  if (answer.status !== 200) throw new Error(`sign-in failed: ${JSON.stringify(answer.body)}`);
  return { access: String(pick(answer.body, "data.accessToken")), refresh: String(pick(answer.body, "data.refreshToken")) };
}

/** A request as the bootstrap admin. */
export async function asAdmin(app: FastifyInstance, method: Method, url: string, body?: unknown): Promise<Answer> {
  return send(app, method, url, body, (await signIn(app)).access);
}
