-- 001-init: the channels (docs/03 section 7.2) and the one revision counter (section 7). A change is
-- live as soon as it is saved: there are no drafts, publications or audit rows.

CREATE TABLE channels (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  category   TEXT NOT NULL,
  number     TEXT,
  logo_url   TEXT,
  stream_url TEXT NOT NULL,
  revision   INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

-- Exactly one row: the backend's revision, raised by one on every change.
CREATE TABLE backend_revision (
  id       INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL
);
INSERT INTO backend_revision (id, revision) VALUES (1, 0);
