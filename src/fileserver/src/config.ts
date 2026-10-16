import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

/** src/fileserver, whether running from src/ (tsx) or dist/ (built). */
const PROGRAM_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Today the fileserver serves the proof of concept (docs/14); phase 3 points this at the built interface. */
const DEFAULT_WEB_DIST = path.resolve(PROGRAM_ROOT, "..", "mockup");

/** Env parsing (docs/03 section 1) — the only place `process.env` is read. */
const BooleanFlag = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const EnvSchema = z.object({
  PORT: z.coerce.number().int().min(0).max(65535).default(8090),
  HOST: z.string().default("127.0.0.1"),
  WEB_DIST: z.string().default(DEFAULT_WEB_DIST),
  DATA_DIR: z.string().default(""),
  // A LAN or cloud admin backend must use https; the flag is the development override (03 section 3.2).
  ALLOW_INSECURE_ADMIN: BooleanFlag,
  // How long the live view counts as fresh between on-demand reads (03 section 5.1).
  LIVE_VIEW_TTL_MS: z.coerce.number().int().min(0).max(60 * 60 * 1000).default(30_000),
  // Test lane only: `POST /api/fs/dialog` then takes `{ name }` directly under this root (03 section 3.8).
  TEST_FOLDER_ROOT: z.string().default(""),
});

const env = EnvSchema.parse(process.env);

export const config = {
  port: env.PORT,
  host: env.HOST,
  webDist: path.resolve(env.WEB_DIST),
  /** The fileserver's own data folder: `~/.giga-stream` unless `DATA_DIR` is set. */
  dataDir: env.DATA_DIR !== "" ? path.resolve(env.DATA_DIR) : path.join(os.homedir(), ".giga-stream"),
  allowInsecureAdmin: env.ALLOW_INSECURE_ADMIN,
  liveViewTtlMs: env.LIVE_VIEW_TTL_MS,
  /** Where the proof of concept's saved results go (gitignored). */
  pocResultsDir: path.resolve(env.WEB_DIST, "results"),
  testFolderRoot: path.resolve(env.TEST_FOLDER_ROOT),
  version: "0.2.0",
} as const;
