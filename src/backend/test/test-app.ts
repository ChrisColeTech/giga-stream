import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after } from "node:test";
import type { FastifyInstance } from "fastify";
import WebSocket from "ws";

import { buildApp } from "../src/app.js";
import type { Config } from "../src/config.js";

export const OWNER_EMAIL = "owner@example.test";
export const OWNER_PASSWORD = "owner-password-123";
export const JWT_SECRET = "test-secret-that-is-at-least-32-characters";

/** Longest a test waits for one frame; a frame that never comes fails the test, it does not hang it. */
const FRAME_TIMEOUT_MS = 5000;

/** A clock tests move by hand; nothing sleeps. */
export function testClock(start = Date.UTC(2026, 9, 16, 12)) {
  let at = start;
  return { now: () => at, advance: (ms: number) => void (at += ms) };
}

export interface TestApp {
  app: FastifyInstance;
  dataDir: string;
  clock: ReturnType<typeof testClock>;
  dispose(): Promise<void>;
}

const created: TestApp[] = [];
const sockets: WebSocket[] = [];

/** A fresh app on a fresh temporary data folder, with the bootstrap owner: no shared state, no network. */
export async function makeApp(
  options: { seed?: boolean; loopback?: boolean; dataDir?: string; config?: Partial<Config>; fetch?: typeof fetch } = {},
): Promise<TestApp> {
  const dataDir = options.dataDir ?? mkdtempSync(path.join(os.tmpdir(), "giga-backend-test-"));
  const clock = testClock();
  const app = await buildApp(
    {
      NODE_ENV: "test",
      HOST: "127.0.0.1",
      DATA_DIR: dataDir,
      JWT_SECRET,
      ADMIN_BOOTSTRAP_EMAIL: OWNER_EMAIL,
      ADMIN_BOOTSTRAP_PASSWORD: OWNER_PASSWORD,
      TLS_CERT_FILE: "",
      TLS_KEY_FILE: "",
      TRUST_PROXY: false,
      ALLOW_INSECURE_HTTP: false,
      CORS_ORIGINS: "",
      TMDB_READ_TOKEN: "",
      SEED_TEST_CHANNELS: options.seed ?? false,
      ALLOW_LOOPBACK_STREAMS: options.loopback ?? options.seed ?? false,
      ...options.config,
    },
    clock.now,
    options.fetch,
  );
  let disposed = false;
  const testApp: TestApp = {
    app,
    dataDir,
    clock,
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
  for (const socket of sockets) socket.terminate();
  for (const testApp of created) await testApp.dispose();
});

export interface Answer {
  status: number;
  body: unknown;
  headers: Record<string, unknown>;
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export async function send(
  app: FastifyInstance,
  method: Method,
  url: string,
  body?: unknown,
  token?: string,
  address = "127.0.0.1",
): Promise<Answer> {
  const headers: Record<string, string> = {};
  if (token !== undefined) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  const reply = await app.inject({
    method,
    url,
    headers,
    remoteAddress: address,
    ...(body !== undefined && { payload: JSON.stringify(body) }),
  });
  return { status: reply.statusCode, body: reply.body === "" ? null : JSON.parse(reply.body), headers: reply.headers };
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
export async function signIn(app: FastifyInstance, email = OWNER_EMAIL, password = OWNER_PASSWORD) {
  const answer = await send(app, "POST", "/api/auth/login", { email, password });
  if (answer.status !== 200) throw new Error(`sign-in failed: ${JSON.stringify(answer.body)}`);
  return { access: String(pick(answer.body, "data.accessToken")), refresh: String(pick(answer.body, "data.refreshToken")) };
}

/** A request as the bootstrap owner. */
export async function asOwner(app: FastifyInstance, method: Method, url: string, body?: unknown): Promise<Answer> {
  return send(app, method, url, body, (await signIn(app)).access);
}

export interface SocketProbe {
  next(): Promise<unknown>;
  send(text: string): void;
  closed(): Promise<number>;
  close(): void;
}

/** Listens on a free port and opens the socket; frames are awaited, never slept for. */
export async function connectSocket(app: FastifyInstance): Promise<SocketProbe> {
  if (!app.server.listening) await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address();
  if (address === null || typeof address === "string") throw new Error("the test server has no port");
  const socket = new WebSocket(`ws://127.0.0.1:${address.port}/ws`);
  sockets.push(socket);
  const frames: unknown[] = [];
  const waiting: Array<(frame: unknown) => void> = [];
  socket.on("message", (data) => {
    const frame: unknown = JSON.parse(data.toString());
    const waiter = waiting.shift();
    if (waiter) waiter(frame);
    else frames.push(frame);
  });
  const closedCode = new Promise<number>((resolve) => socket.on("close", (code) => resolve(code)));
  await new Promise<void>((resolve, reject) => {
    socket.once("open", () => resolve());
    socket.once("error", reject);
  });
  const within = <T>(wait: Promise<T>, what: string): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timed out waiting for ${what}`)), FRAME_TIMEOUT_MS);
      wait.then(resolve, reject).finally(() => clearTimeout(timer));
    });
  return {
    next: () =>
      frames.length > 0
        ? Promise.resolve(frames.shift())
        : within(new Promise<unknown>((resolve) => waiting.push(resolve)), "the next frame"),
    send: (text) => socket.send(text),
    closed: () => within(closedCode, "the socket to close"),
    close: () => socket.close(),
  };
}
