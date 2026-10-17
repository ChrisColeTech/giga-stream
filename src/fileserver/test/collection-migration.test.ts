import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { migrate, readSchemaVersion } from "../src/store/migrate.js";

test("migration 004 safely types old collections and uses only conclusive title identity", () => {
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
    INSERT INTO collections VALUES
      ('empty', 'Empty', 0, 0), ('movies', 'Movies', 0, 0), ('tv', 'TV', 0, 0),
      ('mixed', 'Mixed', 0, 0), ('folder', 'Folder', 0, 0), ('local-member', 'Local member', 0, 0);
    INSERT INTO collection_items VALUES
      ('i1', 'movies', 'title', 'movie-1', 0), ('i2', 'movies', 'title', 'movie-2', 0),
      ('i3', 'tv', 'title', 'tv-1', 0), ('i4', 'mixed', 'title', 'movie-3', 0),
      ('i5', 'mixed', 'title', 'tv-2', 0), ('i6', 'folder', 'title', 'movie-4', 0),
      ('i7', 'local-member', 'title', 'movie-5', 0), ('i8', 'local-member', 'local', 'file-1', 0);
    INSERT INTO collection_folders VALUES ('f1', 'folder', 'C:\\private', 'private', 0, NULL);
    PRAGMA user_version = 3;
  `);

  assert.equal(migrate(db), 4);
  assert.equal(readSchemaVersion(db), 4);
  const rows = db.prepare("SELECT id, type FROM collections ORDER BY id").all() as Array<{
    id: string;
    type: string;
  }>;
  assert.deepEqual(Object.fromEntries(rows.map((row) => [row.id, row.type])), {
    empty: "local",
    folder: "local",
    "local-member": "local",
    mixed: "local",
    movies: "movie",
    tv: "tv",
  });
  db.close();
});
