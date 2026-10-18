import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { migrate, readSchemaVersion } from "../src/store/migrate.js";

test("migrations after v3 safely type old collections and backfill local titles", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE collections (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE collection_items (
      id TEXT PRIMARY KEY, collection_id TEXT NOT NULL, item_kind TEXT NOT NULL, item_id TEXT NOT NULL,
      added_at INTEGER NOT NULL
    );
    CREATE TABLE collection_folders (
      id TEXT PRIMARY KEY, collection_id TEXT NOT NULL, path TEXT NOT NULL, name TEXT NOT NULL,
      created_at INTEGER NOT NULL, last_scanned_at INTEGER
    );
    CREATE TABLE local_files (
      id TEXT PRIMARY KEY, folder_id TEXT NOT NULL, collection_id TEXT NOT NULL, path TEXT NOT NULL,
      title TEXT NOT NULL, size_bytes INTEGER, mtime_ms INTEGER, duration_ms INTEGER, width INTEGER,
      height INTEGER, video_codec TEXT, audio_codec TEXT, container TEXT, playable INTEGER NOT NULL DEFAULT 1,
      probe_error_code TEXT, probe_error_message TEXT, poster_id TEXT, added_at INTEGER NOT NULL,
      UNIQUE (folder_id, path)
    );
    INSERT INTO collections VALUES
      ('empty', 'Empty', 0, 0), ('movies', 'Movies', 0, 0), ('tv', 'TV', 0, 0),
      ('mixed', 'Mixed', 0, 0), ('folder', 'Folder', 0, 0), ('local-member', 'Local member', 0, 0),
      ('uppercase', 'Uppercase', 0, 0), ('empty-suffix', 'Empty suffix', 0, 0),
      ('malformed', 'Malformed', 0, 0), ('bad-tv', 'Bad TV', 0, 0);
    INSERT INTO collection_items VALUES
      ('i1', 'movies', 'title', 'movie-1', 0), ('i2', 'movies', 'title', 'movie-2', 0),
      ('i3', 'tv', 'title', 'tv-1', 0), ('i4', 'mixed', 'title', 'movie-3', 0),
      ('i5', 'mixed', 'title', 'tv-2', 0), ('i6', 'folder', 'title', 'movie-4', 0),
      ('i7', 'local-member', 'title', 'movie-5', 0), ('i8', 'local-member', 'local', 'file-1', 0),
      ('i9', 'uppercase', 'title', 'Movie-6', 0), ('i10', 'empty-suffix', 'title', 'movie-', 0),
      ('i11', 'malformed', 'title', 'movie-7x', 0), ('i12', 'bad-tv', 'title', 'tv-8x', 0);
    INSERT INTO collection_folders VALUES ('f1', 'folder', 'C:\\private', 'private', 0, NULL);
    INSERT INTO local_files (id, folder_id, collection_id, path, title, added_at)
      VALUES ('file-1', 'f1', 'folder', 'C:\\private\\Feature.mkv', '', 0);
    PRAGMA user_version = 3;
  `);

  assert.equal(migrate(db), 7);
  assert.equal(readSchemaVersion(db), 7);
  assert.equal(
    (db.prepare("SELECT title FROM local_files WHERE id = 'file-1'").get() as { title: string }).title,
    "Feature.mkv",
  );
  const rows = db.prepare("SELECT id, type FROM collections ORDER BY id").all() as Array<{
    id: string;
    type: string;
  }>;
  assert.deepEqual(Object.fromEntries(rows.map((row) => [row.id, row.type])), {
    "bad-tv": "local",
    empty: "local",
    "empty-suffix": "local",
    folder: "local",
    "local-member": "local",
    malformed: "local",
    mixed: "local",
    movies: "movie",
    tv: "tv",
    uppercase: "local",
  });
  db.close();
});
