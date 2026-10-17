import os from "node:os";
import path from "node:path";
import { z } from "zod";

/** Env parsing (docs/03 section 1) — the only place `process.env` is read. */
const BooleanFlag = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

/** `PLAYLIST_URLS`: a comma-separated list of https playlist addresses (docs/03 section 7.2c). */
const PlaylistUrls = z.string().default("").transform((value, ctx): string[] => {
  const urls = value.split(",").map((item) => item.trim()).filter((item) => item !== "");
  for (const url of urls) {
    let https = false;
    try {
      https = new URL(url).protocol === "https:";
    } catch {
      https = false;
    }
    if (!https) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `PLAYLIST_URLS must be comma-separated https addresses: ${url}` });
  }
  return urls;
});

/** Development and production never share a port (docs/03 section 1); `npm start` is production. */
const PORTS = { development: 8091, production: 8191 } as const;

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  // Tests use port 0; unset, the port follows NODE_ENV.
  PORT: z.coerce.number().int().min(0).max(65535).optional(),
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
  // The stream rule (docs/03 section 7.5): {tmdbId} (and {season}/{episode} on the episode template)
  // are filled on every movie detail and episode answered; a template that is not set leaves streamUrl
  // absent. This is the dev lane; with providers, sources ride alongside.
  MOVIE_STREAM_TEMPLATE: z.string().default(""),
  EPISODE_STREAM_TEMPLATE: z.string().default(""),
  SEED_TEST_CHANNELS: BooleanFlag,
  ALLOW_LOOPBACK_STREAMS: BooleanFlag,
  // The playlist sync (docs/03 section 7.2c). With PLAYLIST_URLS unset the sync has nothing to do
  // and the schedule stays unarmed.
  PLAYLIST_URLS: PlaylistUrls,
  // The playlist-sync interval, e.g. "6h" or "24h"; empty or "off" disables it.
  PLAYLIST_SYNC_SCHEDULE: z.string().default(""),
  PLAYLIST_SYNC_MAX_BYTES: z.coerce.number().int().min(1).default(8 * 1024 * 1024),
  PLAYLIST_SYNC_MAX: z.coerce.number().int().min(1).default(5_000),
  LOGO_INDEX_TTL_HOURS: z.coerce.number().positive().default(24),
});

const parsed = EnvSchema.parse(process.env);

export const config = {
  ...parsed,
  PORT: parsed.PORT ?? PORTS[parsed.NODE_ENV === "production" ? "production" : "development"],
  DATA_DIR: parsed.DATA_DIR || path.join(os.homedir(), ".giga-stream-admin"),
};

export type Config = typeof config;
