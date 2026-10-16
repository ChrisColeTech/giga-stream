import path from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

/** src/fileserver, whether running from src/ (tsx) or dist/ (built). */
const PROGRAM_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Today the fileserver serves the proof of concept (docs/14); phase 3 points this at the built interface. */
const DEFAULT_WEB_DIST = path.resolve(PROGRAM_ROOT, "..", "mockup");

const EnvSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(8090),
  HOST: z.string().default("127.0.0.1"),
  WEB_DIST: z.string().default(DEFAULT_WEB_DIST),
});

const env = EnvSchema.parse(process.env);

export const config = {
  port: env.PORT,
  host: env.HOST,
  webDist: path.resolve(env.WEB_DIST),
  /** Where the proof of concept's saved results go (gitignored). */
  pocResultsDir: path.resolve(env.WEB_DIST, "results"),
  version: "0.1.0",
} as const;
