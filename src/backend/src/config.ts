import os from "node:os";
import path from "node:path";
import { z } from "zod";

/** Env parsing (docs/03 section 1) — the only place `process.env` is read. */
const BooleanFlag = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  // Tests use port 0.
  PORT: z.coerce.number().int().min(0).max(65535).default(8091),
  HOST: z.string().default("127.0.0.1"),
  DATA_DIR: z.string().default(""),
  // Signs access tokens (docs/03 section 7.12). The backend refuses to start without one.
  JWT_SECRET: z.string().default(""),
  // The first owner, created when there are no accounts (section 7.11).
  ADMIN_BOOTSTRAP_EMAIL: z.string().default(""),
  ADMIN_BOOTSTRAP_PASSWORD: z.string().default(""),
  // Serving over the network (section 7.10).
  TLS_CERT_FILE: z.string().default(""),
  TLS_KEY_FILE: z.string().default(""),
  TRUST_PROXY: BooleanFlag,
  ALLOW_INSECURE_HTTP: BooleanFlag,
  CORS_ORIGINS: z.string().default(""),
  // TMDB (docs/03 sections 7.4-7.6b). TMDB_BASE overrides the API host in tests only.
  TMDB_READ_TOKEN: z.string().default(""),
  // The catalog-sync interval, e.g. "6h" or "30m"; empty or "off" disables it (docs/03 section 7.6b).
  TMDB_SYNC_SCHEDULE: z.string().default(""),
  TMDB_BASE: z.string().default("https://api.themoviedb.org/3"),
  // OMDb detail enrichment (docs/11 section 7). The base and limit are test knobs; the key is real.
  OMDB_API_KEY: z.string().default(""),
  OMDB_BASE: z.string().default("https://www.omdbapi.com/"),
  OMDB_DAILY_LIMIT: z.coerce.number().int().min(1).max(100_000).default(1_000),
  SEED_TEST_CHANNELS: BooleanFlag,
  ALLOW_LOOPBACK_STREAMS: BooleanFlag,
});

const parsed = EnvSchema.parse(process.env);

export const config = {
  ...parsed,
  DATA_DIR: parsed.DATA_DIR || path.join(os.homedir(), ".giga-stream-admin"),
};

export type Config = typeof config;
