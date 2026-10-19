// The cached-title page reads after the id-first shape and migration 007 (docs/46 sections A and B): the answers equal
// the pre-007 query (EXISTS, wide columns sorted) for every sort and filter, and the sort indexes exist and are used.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { createCachedTitleQuery } from "../src/store/cached-title-query.js";
import { migrate } from "../src/store/migrate.js";
import type { TitleFilter, TitlePageRequest } from "../src/types/cached-title.js";
import type { TitleSort } from "../src/services/admin-titles.js";

const GENRES = ["Action", "Comedy", "Drama", "Horror", "Sci-Fi", "War"];
const SORTS: TitleSort[] = ["newest", "oldest", "year", "az", "trending"];
const TIE = "t.title COLLATE NOCASE, t.id";
const POP = "t.popularity IS NULL, t.popularity DESC";
/** The pre-007 ORDER BY of each sort, copied so the new answers are compared with the old ones. */
const OLD_ORDER: Record<TitleSort, string> = {
  newest: `t.year IS NULL, t.year DESC, ${POP}, ${TIE}`,
  oldest: `t.year IS NULL, t.year ASC, ${POP}, ${TIE}`,
  year: `t.year IS NULL, t.year DESC, ${TIE}`,
  az: TIE,
  trending: `${POP}, ${TIE}`,
};

function migrationsUpTo(db: DatabaseSync, last: number): void {
  const dir = new URL("../src/store/migrations/", import.meta.url);
  const names = [
    "001-init", "002-drop-synced-catalog", "003-settings-admin-url", "004-collection-type", "005-local-file-titles",
    "006-backend-cache",
  ];
  for (const name of names.slice(0, last)) db.exec(readFileSync(new URL(`${name}.sql`, dir), "utf-8"));
  db.exec(`PRAGMA user_version = ${last}`);
}

/** A deterministic catalog with ties on year and popularity, null years and popularity, and 1 to 3 genres each. */
function seed(db: DatabaseSync, count: number): void {
  const add = db.prepare(
    "INSERT INTO cached_titles (id, kind, title, year, rating, popularity, poster_url) VALUES (?, ?, ?, ?, 5, ?, 'p')",
  );
  const tag = db.prepare("INSERT INTO cached_title_genres (title_id, genre) VALUES (?, ?)");
  for (let i = 0; i < count; i++) {
    const id = `t${String(i).padStart(4, "0")}`;
    const name = `${i % 7 === 0 ? "Zed" : "alpha"} ${(i * 37) % 101} ${i % 3 === 0 ? "B" : "b"}`;
    const year = i % 11 === 0 ? null : 1990 + (i % 6);
    add.run(id, i % 3 === 0 ? "tv" : "movie", name, year, i % 13 === 0 ? null : (i * 7) % 50);
    for (let k = 0; k <= i % 3; k++) tag.run(id, GENRES[(i + k * 2) % GENRES.length] ?? "Drama");
  }
  db.exec(`INSERT INTO watch_entries (id, item_kind, item_id, position_ms, duration_ms, state, updated_at)
    SELECT 'w' || id, 'title', id, 1, 2, 'watching', 3 FROM cached_titles WHERE rowid % 5 = 0`);
}

/** The old query shape: the EXISTS filter and the genre subquery carried through the sort. */
function oldPage(
  db: DatabaseSync, filter: TitleFilter, sort: TitleSort, offset: number, limit: number,
): { ids: string[]; total: number } {
  const parts = ["1"];
  const params: Array<string | number> = [];
  if (filter.kinds.length === 1) {
    parts.push("t.kind = ?");
    params.push(filter.kinds[0] ?? "movie");
  }
  if (filter.q !== undefined) {
    parts.push("t.title LIKE ? ESCAPE '\\'");
    params.push(`%${filter.q}%`);
  }
  if (filter.genres.length > 0) {
    const marks = filter.genres.map(() => "?").join(",");
    parts.push(`EXISTS (SELECT 1 FROM cached_title_genres g WHERE g.title_id = t.id AND g.genre IN (${marks}))`);
    params.push(...filter.genres);
  }
  if (filter.year !== undefined) {
    parts.push("t.year = ?");
    params.push(filter.year);
  }
  if (filter.unwatched) {
    parts.push("NOT EXISTS (SELECT 1 FROM watch_entries w WHERE w.item_kind = 'title' AND w.item_id = t.id)");
  }
  const where = parts.join(" AND ");
  const order = filter.q !== undefined ? `${POP}, ${TIE}` : OLD_ORDER[sort];
  const genres = "(SELECT json_group_array(g.genre) FROM cached_title_genres g WHERE g.title_id = t.id)";
  const sql = `SELECT t.id, ${genres} AS genres_json FROM cached_titles t WHERE ${where}
    ORDER BY ${order} LIMIT ? OFFSET ?`;
  const ids = db.prepare(sql).all(...params, limit, offset).map((row) => String((row as { id: string }).id));
  const count = db.prepare(`SELECT COUNT(*) AS n FROM cached_titles t WHERE ${where}`).get(...params) as { n: number };
  return { ids, total: count.n };
}

const FILTERS: TitleFilter[] = [
  { kinds: ["movie", "tv"], genres: [], unwatched: false },
  { kinds: ["movie"], genres: [], unwatched: false },
  { kinds: ["tv"], genres: ["Drama"], unwatched: false },
  { kinds: ["movie", "tv"], genres: ["Action", "War"], unwatched: false },
  { kinds: ["movie", "tv"], genres: ["Comedy", "Horror", "Sci-Fi"], year: 1992, unwatched: false },
  { kinds: ["movie", "tv"], genres: ["Drama"], unwatched: true },
  { kinds: ["movie", "tv"], genres: [], unwatched: true, q: "zed" },
  { kinds: [], genres: [], unwatched: false },
];

function assertSameAsOld(db: DatabaseSync, count: number): void {
  const query = createCachedTitleQuery(db);
  for (const filter of FILTERS) {
    for (const sort of SORTS) {
      const pages = [[0, 25], [count - 30, 25], [Math.floor(count / 2), 40], [count + 5, 10]] as const;
      for (const [offset, limit] of pages) {
        const request: TitlePageRequest = { ...filter, sort, offset, limit };
        const got = query.page(request);
        const label = `${JSON.stringify(filter)} ${sort} ${offset}`;
        // No kind selected matches nothing; the old query had the same "0" predicate.
        if (filter.kinds.length === 0) {
          assert.deepEqual(got, { rows: [], total: 0 }, label);
          continue;
        }
        const old = oldPage(db, filter, sort, offset, limit);
        assert.deepEqual(got.rows.map((row) => row.id), old.ids, label);
        assert.equal(got.total, old.total, label);
      }
    }
  }
}

test("every sort and filter answers exactly as the pre-007 query did, at the start, the middle and the end", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  assert.equal(migrate(db), 9);
  seed(db, 700);
  assertSameAsOld(db, 700);
  db.close();
});

test("a version 6 cache keeps its titles and answers the same after upgrading through 9", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  migrationsUpTo(db, 6);
  seed(db, 400);
  const before = createCachedTitleQuery(db).page({ ...FILTERS[3]!, sort: "newest", offset: 100, limit: 50 });
  assert.equal(migrate(db), 9);
  const after = createCachedTitleQuery(db).page({ ...FILTERS[3]!, sort: "newest", offset: 100, limit: 50 });
  assert.deepEqual(after, before);
  assert.deepEqual({ ...(db.prepare("SELECT COUNT(*) AS n FROM cached_titles").get() as object) }, { n: 400 });
  assert.equal(db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'cached_titles_title'").get(), undefined);
  assertSameAsOld(db, 400);
  db.close();
});

test("a sort page walks its covering index: no sort step for any of the five orders", () => {
  const db = new DatabaseSync(":memory:");
  assert.equal(migrate(db), 9);
  seed(db, 300);
  db.exec("ANALYZE");
  for (const sort of SORTS) {
    const sql = `EXPLAIN QUERY PLAN SELECT t.id FROM cached_titles t ORDER BY ${OLD_ORDER[sort]} LIMIT 40 OFFSET 250`;
    const plan = db.prepare(sql).all();
    const text = plan.map((row) => String((row as { detail: string }).detail)).join(" | ");
    assert.match(text, /COVERING INDEX cached_titles_/, sort);
    assert.doesNotMatch(text, /TEMP B-TREE/, sort);
  }
  db.close();
});
