import { createClient, type Client } from "@libsql/client";

/** A minimal version-32 admin schema for fileserver tests. Production never runs this. */
export async function makeAdminDatabase(): Promise<Client> {
  const database = createClient({ url: ":memory:" });
  await database.executeMultiple(`
    CREATE TABLE giga_stream_schema_version (id INTEGER PRIMARY KEY, version INTEGER NOT NULL);
    INSERT INTO giga_stream_schema_version VALUES (1, 32);
    CREATE TABLE backend_revision (id INTEGER PRIMARY KEY, revision INTEGER NOT NULL);
    INSERT INTO backend_revision VALUES (1, 0);
    CREATE TABLE playlists (id INTEGER PRIMARY KEY, enabled INTEGER NOT NULL);
    CREATE TABLE channels (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, number TEXT, logo_url TEXT,
      logo_file TEXT, stream_url TEXT, kind TEXT NOT NULL, revision INTEGER NOT NULL, enabled INTEGER NOT NULL,
      playlist_id INTEGER REFERENCES playlists(id)
    );
    CREATE TABLE titles (
      id TEXT PRIMARY KEY, kind TEXT NOT NULL, tmdb_id INTEGER, payload TEXT NOT NULL,
      popularity_score REAL, enabled INTEGER NOT NULL
    );
    CREATE TABLE title_genres (kind TEXT NOT NULL, genre_id INTEGER NOT NULL, name TEXT NOT NULL);
    CREATE TABLE admin_accounts (
      id TEXT PRIMARY KEY, username TEXT NOT NULL, username_key TEXT NOT NULL UNIQUE, kind TEXT NOT NULL,
      password_hash TEXT NOT NULL, disabled INTEGER NOT NULL, session_version INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, last_sign_in_at INTEGER,
      security_question INTEGER, security_answer_hash TEXT
    );
    CREATE TABLE refresh_tokens (
      id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES admin_accounts(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
      used_at INTEGER, revoked_at INTEGER
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
    CREATE TABLE user_watch (
      id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES admin_accounts(id) ON DELETE CASCADE,
      item_kind TEXT NOT NULL, item_id TEXT NOT NULL, season INTEGER, episode INTEGER,
      position_ms INTEGER NOT NULL, duration_ms INTEGER, state TEXT NOT NULL, updated_at INTEGER NOT NULL,
      playback_id TEXT NOT NULL, seq INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX idx_user_watch_identity
      ON user_watch(account_id, item_kind, item_id, COALESCE(season, 0), COALESCE(episode, 0));
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
    sql: "INSERT INTO titles (id, kind, tmdb_id, payload, popularity_score, enabled) VALUES (?, ?, ?, ?, ?, 1)",
    args: [value.id, value.kind, tmdbId, JSON.stringify(payload), value.popularity ?? null],
  });
}
