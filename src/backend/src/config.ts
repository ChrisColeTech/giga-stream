import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import { PLAYLIST_IMPORT_MAX_BYTES, TMDB_MIN_GAP_MS } from "./constants/limits.js";

/** Env parsing (docs/03 section 1) — the only place `process.env` is read. */
const BooleanFlag = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

/** Development and production never share a port (docs/03 section 1); `npm start` is production. */
const PORTS = { development: 8091, production: 8191 } as const;

/** src/backend, whether running from src/ (tsx) or dist/ (built). */
const PROGRAM_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The built admin app (`npm run build` in src/admin), served at `/admin/` (docs/26 section 4.1). */
const DEFAULT_ADMIN_DIST = path.resolve(PROGRAM_ROOT, "..", "admin", "dist");

/** The root-level admin UI served at `/` when it is built (`src/backend/public`). */
const DEFAULT_PUBLIC_DIR = path.resolve(PROGRAM_ROOT, "public");

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  // Tests use port 0; unset, the port follows NODE_ENV.
  PORT: z.coerce.number().int().min(0).max(65535).optional(),
  HOST: z.string().default("127.0.0.1"),
  DATA_DIR: z.string().default(""),
  // Signs access tokens (docs/03 section 7.12). The backend refuses to start without one.
  JWT_SECRET: z.string().default(""),
  // The first admin, created when there are no accounts (section 7.11).
  ADMIN_BOOTSTRAP_USERNAME: z.string().default(""),
  // The name before sign-in became a username; read only when ADMIN_BOOTSTRAP_USERNAME is not set.
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
  // The pause between TMDB requests (about five a second); a test knob, so a fake TMDB is not paced.
  TMDB_MIN_GAP_MS: z.coerce.number().int().min(0).max(10_000).default(TMDB_MIN_GAP_MS),
  // OMDb detail enrichment (docs/11 section 7). The base and limit are test knobs; the key is real.
  OMDB_API_KEY: z.string().default(""),
  OMDB_BASE: z.string().default("https://www.omdbapi.com/"),
  OMDB_DAILY_LIMIT: z.coerce.number().int().min(1).max(100_000).default(1_000),
  // The stream rule (docs/03 section 7.5): {tmdbId} (and {season}/{episode} on the episode template)
  // are filled on every movie detail and episode answered; a template that is not set leaves streamUrl
  // absent. This is the dev lane; with providers, sources ride alongside.
  MOVIE_STREAM_TEMPLATE: z.string().default(""),
  EPISODE_STREAM_TEMPLATE: z.string().default(""),
  // The test channels (docs/10 section 3.3): four live channels made from the fixture files in FIXTURE_DIR and
  // served by this backend itself; a live row stores no address.
  SEED_TEST_CHANNELS: BooleanFlag,
  // The live engine (docs/10 section 4). CACHE_DIR holds loop mode's encodes (large); unset, the backend uses
  // `<DATA_DIR>/cache` of the DATA_DIR it actually runs with, so an override of DATA_DIR moves it too.
  CACHE_DIR: z.string().default(""),
  FIXTURE_DIR: z.string().default(""),
  // Serves /test/player.html, a bare hls.js player for manual checks.
  TEST_PAGE: BooleanFlag,
  // The built admin app, served at /admin/ (docs/26 section 4.1); with no index.html there, nothing is.
  ADMIN_DIST: z.string().default(""),
  // The root-level admin UI served at / when it has an index.html; tests point it at a temporary directory.
  PUBLIC_DIR: z.string().default(""),
  // The store in production is the remote Turso database (docs/13): a local file would be the ephemeral Render
  // disk and would silently lose every admin account on each deploy. The token authenticates it.
  TURSO_DATABASE_URL: z.string().default(""),
  TURSO_AUTH_TOKEN: z.string().default(""),
  // The playlist import and sync (docs/03 section 7.2c). A playlist and its job come from an import; no
  // environment seeds them (PLAYLIST_URLS and PLAYLIST_SYNC_SCHEDULE are retired, docs/43).
  PLAYLIST_SYNC_MAX_BYTES: z.coerce.number().int().min(1).default(PLAYLIST_IMPORT_MAX_BYTES),
  PLAYLIST_SYNC_MAX: z.coerce.number().int().min(1).default(5_000),
  LOGO_INDEX_TTL_HOURS: z.coerce.number().positive().default(24),
});

const parsed = EnvSchema.parse(process.env);

export const config = {
  ...parsed,
  PORT: parsed.PORT ?? PORTS[parsed.NODE_ENV === "production" ? "production" : "development"],
  DATA_DIR: parsed.DATA_DIR || path.join(os.homedir(), ".giga-stream-admin"),
  FIXTURE_DIR: parsed.FIXTURE_DIR || path.join(os.tmpdir(), "giga-stream-fixtures"),
  ADMIN_DIST: path.resolve(parsed.ADMIN_DIST || DEFAULT_ADMIN_DIST),
  PUBLIC_DIR: path.resolve(parsed.PUBLIC_DIR || DEFAULT_PUBLIC_DIR),
};

export type Config = typeof config;
