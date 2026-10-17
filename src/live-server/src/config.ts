import os from "node:os";
import path from "node:path";
import { z } from "zod";

/** Env parsing (docs/10 section 4) — the only place `process.env` is read. */
const BooleanFlag = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

/** Development and production never share a port (docs/03 section 1); `npm start` is production. */
const PORTS = { development: 8097, production: 8197 } as const;

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  // Tests use port 0; unset, the port follows NODE_ENV.
  PORT: z.coerce.number().int().min(0).max(65535).optional(),
  // 0.0.0.0 serves the streams to the LAN; changes are still accepted from this computer only.
  HOST: z.string().default("127.0.0.1"),
  DATA_DIR: z.string().default(""),
  // Loop mode's encoded videos; large, and kept apart so a test run can share one.
  CACHE_DIR: z.string().default(""),
  // The four test channels, made from the fixture files (docs/10 section 2.1), on an empty database.
  SEED_TEST_CHANNELS: BooleanFlag,
  FIXTURE_DIR: z.string().default(""),
  TEST_PAGE: BooleanFlag,
  // More origins allowed to read the streams from a browser, comma-separated; loopback is always allowed.
  CORS_ORIGINS: z.string().default(""),
});

const parsed = EnvSchema.parse(process.env);
const dataDir = parsed.DATA_DIR || path.join(os.homedir(), ".giga-stream-live");

export const config = {
  ...parsed,
  PORT: parsed.PORT ?? PORTS[parsed.NODE_ENV === "production" ? "production" : "development"],
  DATA_DIR: dataDir,
  CACHE_DIR: parsed.CACHE_DIR || path.join(dataDir, "cache"),
  FIXTURE_DIR: parsed.FIXTURE_DIR || path.join(os.tmpdir(), "giga-stream-fixtures"),
};

export type Config = typeof config;
