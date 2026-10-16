import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after } from "node:test";

import { ensureFixtures } from "../../../scripts/fixtures/make-fixtures.mjs";
import { buildLiveServer, type LiveServer } from "../src/app.ts";
import type { Config } from "../src/config.ts";

/**
 * Loop mode's encodes, shared by every test run on this machine: the first run encodes the fixture videos
 * (a minute or two), later runs reuse them. Never the owner's ~/.giga-stream-live.
 */
export const TEST_CACHE_DIR = path.join(os.tmpdir(), "giga-stream-live-test-cache");

/** The fixture files (docs/10 section 2.1), made once per machine. */
export async function fixtures(): Promise<string> {
  return (await ensureFixtures()).dir;
}

/** The path of one fixture video: `fixture(dir, "news", 1)`. */
export const fixture = (dir: string, kind: string, n: number) => path.join(dir, "live", `${kind}-${n}.mp4`);

const created: Array<{ server: LiveServer; dataDir: string }> = [];

/** A fresh live server on a fresh temporary data folder; `seed` adds the four test channels. */
export async function makeServer(
  options: {
    seed?: boolean;
    now?: () => number;
    sleep?: (ms: number) => Promise<void>;
    dataDir?: string;
    config?: Partial<Config>;
  } = {},
): Promise<LiveServer & { dataDir: string }> {
  const dataDir = options.dataDir ?? mkdtempSync(path.join(os.tmpdir(), "giga-live-test-"));
  const server = await buildLiveServer(
    {
      NODE_ENV: "test",
      DATA_DIR: dataDir,
      CACHE_DIR: TEST_CACHE_DIR,
      SEED_TEST_CHANNELS: options.seed ?? false,
      FIXTURE_DIR: await fixtures(),
      TEST_PAGE: false,
      CORS_ORIGINS: "",
      ...options.config,
    },
    { ...(options.now && { now: options.now }), ...(options.sleep && { sleep: options.sleep }) },
  );
  created.push({ server, dataDir });
  return { ...server, dataDir };
}

/** Closes a server (idempotent); its data folder is removed at the end of the file's tests. */
export async function closeServer(server: LiveServer): Promise<void> {
  await server.app.close();
}

after(async () => {
  for (const { server } of created) await server.app.close();
  for (const dataDir of new Set(created.map((entry) => entry.dataDir))) {
    rmSync(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});

export interface Answer {
  status: number;
  body: unknown;
  headers: Record<string, unknown>;
  raw: Buffer;
}

type Method = "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE";

/** One request through Fastify's injector, as a peer at `address`. */
export async function send(
  server: LiveServer,
  method: Method,
  url: string,
  options: { body?: unknown; headers?: Record<string, string>; address?: string } = {},
): Promise<Answer> {
  const headers: Record<string, string> = { ...options.headers };
  if (options.body !== undefined) headers["content-type"] = "application/json";
  const reply = await server.app.inject({
    method,
    url,
    headers,
    remoteAddress: options.address ?? "127.0.0.1",
    ...(options.body !== undefined && { payload: JSON.stringify(options.body) }),
  });
  const json = String(reply.headers["content-type"] ?? "").startsWith("application/json");
  return { status: reply.statusCode, body: json ? JSON.parse(reply.body) : null, headers: reply.headers, raw: reply.rawPayload };
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
