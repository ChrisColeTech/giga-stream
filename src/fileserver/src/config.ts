import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

/** src/fileserver, whether running from src/ (tsx) or dist/ (built). */
const PROGRAM_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The built interface (`npm run build` in src/frontend), served same-origin like the other family apps. */
const DEFAULT_WEB_DIST = path.resolve(PROGRAM_ROOT, "..", "frontend", "dist");

/** The proof of concept (docs/14), served instead when `WEB_DIST` points at it; its results stay beside it. */
const POC_DIR = path.resolve(PROGRAM_ROOT, "..", "mockup");

/**
 * Development and production never share a port (docs/03 section 1): this fileserver, and the admin
 * backend it reads by default. Production is the packaged app, which sets `NODE_ENV=production`.
 */
const PORTS = { development: 8090, production: 8190 } as const;
const ADMIN_PORTS = { development: 8091, production: 8191 } as const;

/** Env parsing (docs/03 section 1) — the only place `process.env` is read. */
const BooleanFlag = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().min(0).max(65535).optional(),
  HOST: z.string().default("127.0.0.1"),
  WEB_DIST: z.string().default(DEFAULT_WEB_DIST),
  DATA_DIR: z.string().default(""),
  // A LAN or cloud admin backend must use https; the flag is the development override (03 section 3.2).
  ALLOW_INSECURE_ADMIN: BooleanFlag,
  // Desktop shell only: the page the window loads, overriding the Vite-or-own-origin choice (src/app/main.ts).
  GIGA_APP_URL: z.string().trim().default(""),
  // Test lane only: `POST /api/fs/dialog` then takes `{ name }` directly under this root (03 section 3.8).
  TEST_FOLDER_ROOT: z.string().default(""),
  // Render's one public port (docs/03 section 1): the admin backend this fileserver reverse-proxies at
  // `/api/admin` (identity, its admin API), `/api/account` (identity, the app's account API), `/admin`
  // (stripped, its console UI) and `/live`, `/logos` (pass-through streams). Empty falls back to the
  // saved `adminUrl` setting (docs/62 D7); neither means the proxy is off, the desktop shape with no
  // sibling.
  ADMIN_PROXY_TARGET: z.string().trim().default(""),
  // Deployment only (docs/62 wave 0): set on a public deployment, the unauthenticated write routes for
  // settings, favorites, collections and watch history refuse (403 writes.closed) until accounts ship.
  // A desktop never sets it, because its local writes are the point.
  REQUIRE_ACCOUNT_WRITES: BooleanFlag,
});

const env = EnvSchema.parse(process.env);
const mode = env.NODE_ENV === "production" ? "production" : "development";

export const config = {
  port: env.PORT ?? PORTS[mode],
  /** The admin backend's address until Settings names another. */
  defaultAdminUrl: `http://127.0.0.1:${ADMIN_PORTS[mode]}`,
  host: env.HOST,
  webDist: path.resolve(env.WEB_DIST),
  /** The fileserver's own data folder: `~/.giga-stream` unless `DATA_DIR` is set. */
  dataDir: env.DATA_DIR !== "" ? path.resolve(env.DATA_DIR) : path.join(os.homedir(), ".giga-stream"),
  allowInsecureAdmin: env.ALLOW_INSECURE_ADMIN,
  appUrl: env.GIGA_APP_URL,
  /** Where the proof of concept's saved results go (gitignored). */
  pocResultsDir: path.join(POC_DIR, "results"),
  // Empty stays empty (path.resolve("") would answer the process working directory, a root that
  // is never empty and so would leave the test lane always on); a set value becomes absolute.
  testFolderRoot: env.TEST_FOLDER_ROOT !== "" ? path.resolve(env.TEST_FOLDER_ROOT) : "",
  /** The admin backend to reverse-proxy (`/api/admin`, `/api/account`, `/admin`, `/live`, `/logos`); empty
   *  falls back to the saved `adminUrl` setting, and neither leaves the proxy off. */
  adminProxyTarget: env.ADMIN_PROXY_TARGET,
  /** Deployment only (docs/62 wave 0): on, the shared write routes refuse with `403 writes.closed`. */
  requireAccountWrites: env.REQUIRE_ACCOUNT_WRITES,
  version: "0.2.0",
} as const;
