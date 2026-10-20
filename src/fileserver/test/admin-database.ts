import { createClient, type Client, type InStatement } from "@libsql/client";

const DATABASE_SEAM = Symbol("admin-database-seam");

interface DatabaseFetch extends Function {
  [DATABASE_SEAM]?: () => Promise<Client>;
}

export function attachAdminDatabase(fetcher: typeof fetch, database: () => Promise<Client>): typeof fetch {
  Object.defineProperty(fetcher, DATABASE_SEAM, { value: database });
  return fetcher;
}

export function databaseOf(fetcher: typeof fetch | undefined): Promise<Client> | undefined {
  if (fetcher === undefined) return undefined;
  const seam = (fetcher as DatabaseFetch)[DATABASE_SEAM];
  return seam?.();
}

export function controlledDatabase(
  database: Client,
  before: (sql: string) => Promise<void>,
): Client {
  return new Proxy(database, {
    get(target, property) {
      if (property === "execute") {
        return async (statement: string | InStatement) => {
          await before(typeof statement === "string" ? statement : statement.sql);
          return target.execute(statement);
        };
      }
      if (property === "batch") {
        return async (statements: InStatement[]) => {
          await before(statements.map((statement) =>
            typeof statement === "string" ? statement : statement.sql).join(";"));
          return target.batch(statements);
        };
      }
      const value: unknown = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

/** A minimal version-32 admin schema for fileserver tests. Production never runs this. */
export async function makeAdminDatabase(): Promise<Client> {
  const database = createClient({ url: ":memory:" });
  await database.executeMultiple(`
    PRAGMA foreign_keys = ON;
    PRAGMA user_version = 32;
    CREATE TABLE giga_stream_schema_version (
      id INTEGER PRIMARY KEY CHECK (id = 1), version INTEGER NOT NULL
    );
    INSERT INTO giga_stream_schema_version VALUES (1, 32);
    CREATE TABLE backend_revision (id INTEGER PRIMARY KEY CHECK (id = 1), revision INTEGER NOT NULL);
    INSERT INTO backend_revision VALUES (1, 0);
    CREATE TABLE playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      kind TEXT NOT NULL CHECK (kind IN ('file', 'url')), url TEXT UNIQUE, file_name TEXT UNIQUE,
      host TEXT, enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)), created_at INTEGER NOT NULL,
      CHECK ((kind = 'url' AND url IS NOT NULL AND host IS NOT NULL AND file_name IS NULL)
        OR (kind = 'file' AND file_name IS NOT NULL AND url IS NULL AND host IS NULL))
    );
    CREATE TABLE channels (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, number TEXT, logo_url TEXT,
      stream_url TEXT, revision INTEGER NOT NULL, created_at INTEGER NOT NULL, tvg_id TEXT,
      kind TEXT NOT NULL DEFAULT 'stream' CHECK (kind IN ('stream', 'live')),
      live_mode TEXT CHECK (live_mode IN ('loop', 'encode')), live_captions INTEGER CHECK (live_captions IN (0, 1)),
      live_variants TEXT, live_folder TEXT, edited_fields TEXT, sync_name TEXT,
      enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
      playlist_id INTEGER REFERENCES playlists(id) ON DELETE CASCADE,
      status TEXT CHECK (status IN ('online', 'offline')), checked_at INTEGER,
      logo_file TEXT, logo_checked_at INTEGER,
      CHECK ((kind = 'stream' AND stream_url IS NOT NULL AND live_mode IS NULL)
        OR (kind = 'live' AND stream_url IS NULL AND live_mode IS NOT NULL
          AND live_captions IS NOT NULL AND live_variants IS NOT NULL)),
      CHECK (playlist_id IS NULL OR (kind = 'stream' AND sync_name IS NOT NULL)),
      CHECK (status IS NULL OR kind = 'stream')
    );
    CREATE UNIQUE INDEX channels_live_number ON channels(number) WHERE kind = 'live';
    CREATE INDEX channels_playlist ON channels(playlist_id);
    CREATE TABLE channel_videos (
      channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      position INTEGER NOT NULL, path TEXT NOT NULL, PRIMARY KEY(channel_id, position)
    );
    CREATE TABLE titles (
      id TEXT PRIMARY KEY, kind TEXT NOT NULL, tmdb_id INTEGER, payload TEXT NOT NULL,
      popularity_score REAL, popularity_read_at INTEGER, fetched_at INTEGER NOT NULL,
      origin TEXT NOT NULL DEFAULT 'tmdb' CHECK (origin IN ('tmdb', 'manual')), edited_fields TEXT,
      enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
      detail_failed_at INTEGER, detail_failures INTEGER, omdb_failed_at INTEGER,
      CHECK (origin = 'manual' OR tmdb_id IS NOT NULL)
    );
    CREATE UNIQUE INDEX titles_tmdb ON titles(kind, tmdb_id) WHERE origin = 'tmdb';
    CREATE INDEX idx_titles_fetched ON titles(fetched_at);
    CREATE INDEX idx_titles_origin ON titles(origin);
    CREATE INDEX idx_titles_popularity ON titles(popularity_score);
    CREATE TABLE title_genres (
      kind TEXT NOT NULL CHECK (kind IN ('movie', 'tv')), genre_id INTEGER NOT NULL,
      name TEXT NOT NULL, PRIMARY KEY(kind, genre_id)
    );
    CREATE TABLE admin_accounts (
      id TEXT PRIMARY KEY, username TEXT NOT NULL, username_key TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL DEFAULT 'admin',
      password_hash TEXT NOT NULL, disabled INTEGER NOT NULL DEFAULT 0,
      session_version INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, last_sign_in_at INTEGER,
      security_question INTEGER CHECK (security_question BETWEEN 1 AND 8), security_answer_hash TEXT,
      CHECK (kind IN ('admin', 'user'))
    );
    CREATE TABLE refresh_tokens (
      id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES admin_accounts(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
      used_at INTEGER, revoked_at INTEGER
    );
    CREATE INDEX idx_refresh_tokens_account ON refresh_tokens(account_id);
    CREATE TABLE audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, actor_id TEXT,
      actor_username TEXT, action TEXT NOT NULL, subject TEXT, detail TEXT, address TEXT
    );
    CREATE TABLE user_settings (
      account_id TEXT PRIMARY KEY REFERENCES admin_accounts(id) ON DELETE CASCADE,
      settings TEXT NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE user_favorites (
      account_id TEXT NOT NULL REFERENCES admin_accounts(id) ON DELETE CASCADE,
      ref_kind TEXT NOT NULL, ref_id TEXT NOT NULL, created_at INTEGER NOT NULL,
      PRIMARY KEY(account_id, ref_kind, ref_id)
    );
    CREATE TABLE user_collections (
      id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES admin_accounts(id) ON DELETE CASCADE,
      name TEXT NOT NULL, type TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE user_collection_items (
      collection_id TEXT NOT NULL REFERENCES user_collections(id) ON DELETE CASCADE,
      ref_kind TEXT NOT NULL, ref_id TEXT NOT NULL, added_at INTEGER NOT NULL,
      PRIMARY KEY(collection_id, ref_kind, ref_id)
    );
    CREATE INDEX idx_user_collections_account ON user_collections(account_id);
    CREATE TABLE user_watch (
      id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES admin_accounts(id) ON DELETE CASCADE,
      item_kind TEXT NOT NULL CHECK (item_kind IN ('title', 'local')), item_id TEXT NOT NULL,
      season INTEGER, episode INTEGER, position_ms INTEGER NOT NULL, duration_ms INTEGER,
      state TEXT NOT NULL CHECK (state IN ('watching', 'watched')), updated_at INTEGER NOT NULL,
      playback_id TEXT NOT NULL, seq INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX idx_user_watch_identity
      ON user_watch(account_id, item_kind, item_id, COALESCE(season, 0), COALESCE(episode, 0));
    CREATE INDEX idx_user_watch_updated ON user_watch(account_id, updated_at DESC);
  `);
  return database;
}

export async function seedTitle(
  database: Client,
  value: { id: string; kind: "movie" | "tv"; title: string; genres?: string[]; popularity?: number; extra?: object },
): Promise<void> {
  const tmdbId = Number(value.id.split("-")[1]);
  const payload = {
    id: value.id, tmdbId, kind: value.kind, title: value.title,
    genres: value.genres ?? [], ...value.extra,
  };
  await database.execute({
    sql: `INSERT INTO titles
      (id, kind, tmdb_id, payload, popularity_score, fetched_at, origin, enabled)
      VALUES (?, ?, ?, ?, ?, 1, 'tmdb', 1)`,
    args: [value.id, value.kind, tmdbId, JSON.stringify(payload), value.popularity ?? null],
  });
}
