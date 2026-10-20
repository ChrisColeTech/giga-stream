import assert from "node:assert/strict";
import test from "node:test";

import { validateAdminSchema } from "../src/store/admin-database.js";
import { makeAdminDatabase } from "./admin-database.js";

const columns = async (database: Awaited<ReturnType<typeof makeAdminDatabase>>, table: string) =>
  (await database.execute(`PRAGMA table_info(${table})`)).rows.map((row) => String(row.name));
const indexes = async (database: Awaited<ReturnType<typeof makeAdminDatabase>>, table: string) =>
  (await database.execute(`PRAGMA index_list(${table})`)).rows.map((row) => String(row.name));

test("the injected admin fixture carries every migration-032 column queried by the fileserver", async () => {
  const database = await makeAdminDatabase();
  await validateAdminSchema(database);
  assert.deepEqual(await columns(database, "channels"), [
    "id", "name", "category", "number", "logo_url", "stream_url", "revision", "created_at",
    "tvg_id", "kind", "live_mode", "live_captions", "live_variants", "live_folder", "edited_fields",
    "sync_name", "enabled", "playlist_id", "status", "checked_at", "logo_file", "logo_checked_at",
  ]);
  assert.deepEqual(await columns(database, "titles"), [
    "id", "kind", "tmdb_id", "payload", "popularity_score", "popularity_read_at", "fetched_at",
    "origin", "edited_fields", "enabled", "detail_failed_at", "detail_failures", "omdb_failed_at",
  ]);
  assert.deepEqual(await columns(database, "admin_accounts"), [
    "id", "username", "username_key", "kind", "password_hash", "disabled", "session_version",
    "created_at", "updated_at", "last_sign_in_at", "security_question", "security_answer_hash",
  ]);
  assert.deepEqual(await columns(database, "refresh_tokens"), [
    "id", "account_id", "token_hash", "created_at", "expires_at", "used_at", "revoked_at",
  ]);
  assert.deepEqual(await columns(database, "audit_log"), [
    "id", "at", "actor_id", "actor_username", "action", "subject", "detail", "address",
  ]);
  assert.deepEqual(await columns(database, "user_settings"), ["account_id", "settings", "updated_at"]);
  assert.deepEqual(await columns(database, "user_favorites"), [
    "account_id", "ref_kind", "ref_id", "created_at",
  ]);
  assert.deepEqual(await columns(database, "user_collections"), [
    "id", "account_id", "name", "type", "created_at", "updated_at",
  ]);
  assert.deepEqual(await columns(database, "user_collection_items"), [
    "collection_id", "ref_kind", "ref_id", "added_at",
  ]);
  assert.deepEqual(await columns(database, "user_watch"), [
    "id", "account_id", "item_kind", "item_id", "season", "episode", "position_ms",
    "duration_ms", "state", "updated_at", "playback_id", "seq",
  ]);
  assert.ok((await indexes(database, "channels")).includes("channels_playlist"));
  assert.ok((await indexes(database, "titles")).includes("titles_tmdb"));
  assert.ok((await indexes(database, "refresh_tokens")).includes("idx_refresh_tokens_account"));
  assert.ok((await indexes(database, "user_watch")).includes("idx_user_watch_identity"));
  database.close();
});

test("real publication constraints retain disabled playlists and derive live rows without a stream URL", async () => {
  const database = await makeAdminDatabase();
  await database.execute(`INSERT INTO playlists
    (id, name, kind, file_name, enabled, created_at) VALUES (1, 'List', 'file', 'list.m3u', 0, 1)`);
  await database.execute(`INSERT INTO channels
    (id, name, category, stream_url, revision, created_at, kind, sync_name, enabled, playlist_id)
    VALUES ('hidden', 'Hidden', 'News', 'http://stream.test/hidden', 1, 1, 'stream', 'Hidden', 1, 1)`);
  await database.execute(`INSERT INTO channels
    (id, name, category, number, stream_url, revision, created_at, kind, live_mode,
      live_captions, live_variants, enabled)
    VALUES ('live', 'Live', 'News', '1', NULL, 1, 1, 'live', 'loop', 0, '[]', 1)`);
  const rows = await database.execute(`SELECT c.id FROM channels c LEFT JOIN playlists p ON p.id = c.playlist_id
    WHERE c.enabled = 1 AND (c.playlist_id IS NULL OR p.enabled = 1)`);
  assert.deepEqual(rows.rows.map((row) => row.id), ["live"]);
  database.close();
});
