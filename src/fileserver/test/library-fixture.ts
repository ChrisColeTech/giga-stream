import { mkdtempSync, writeFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import os from "node:os";
import path from "node:path";

import { makeApp, pick, pointAt, send, type Answer, type FileserverApp, type testClock } from "./app-fixture.js";
import { FAKE_ADMIN_URL } from "./fake-backend.js";
import { fakeTitles, type FakeTitle } from "./fake-titles.js";

const AT = Date.UTC(2026, 9, 16, 12);

/**
 * One local_files row with probe facts and a still, written over the app's database directly (the media.test.ts
 * pattern: real rows without a real scan); the file on disk is real but never read.
 */
export function localFile(
  t: FileserverApp,
  name: string,
  input: { height?: number; posterId?: string; addedAt?: number; collectionId?: string } = {},
): string {
  const db = new DatabaseSync(path.join(t.dataDir, "giga-stream.db"));
  try {
    const folderId = crypto.randomUUID();
    const collectionId = input.collectionId ?? crypto.randomUUID();
    const id = crypto.randomUUID();
    const dir = mkdtempSync(path.join(os.tmpdir(), "giga-lib-"));
    writeFileSync(path.join(dir, name), "bytes");
    if (input.collectionId === undefined) {
      db.prepare("INSERT INTO collections (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)").run(collectionId, "Direct", AT, AT);
    }
    db.prepare("INSERT INTO collection_folders (id, collection_id, path, name, created_at) VALUES (?, ?, ?, ?, ?)").run(folderId, collectionId, dir, name, AT);
    db.prepare(
      "INSERT INTO local_files (id, folder_id, collection_id, path, title, size_bytes, mtime_ms, height, poster_id, playable, added_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)",
    ).run(id, folderId, collectionId, path.join(dir, name), name, 5, AT, input.height ?? null, input.posterId ?? null, input.addedAt ?? AT);
    return id;
  } finally {
    db.close();
  }
}

/** Rows of the app's own database, read through a second connection (WAL lets it read while the app runs). */
export function peek(t: FileserverApp, sql: string, ...params: SQLInputValue[]): Array<Record<string, unknown>> {
  const db = new DatabaseSync(path.join(t.dataDir, "giga-stream.db"), { readOnly: true });
  try {
    return db.prepare(sql).all(...params).map((row) => ({ ...row }));
  } finally {
    db.close();
  }
}

/** The app pointed at a scripted backend serving these titles; nothing is synced until a read or a refresh. */
export async function bootTitles(
  titles: FakeTitle[],
  options: { pageSize?: number; dataDir?: string; clock?: ReturnType<typeof testClock> } = {},
) {
  const backend = fakeTitles(titles, options.pageSize === undefined ? {} : { pageSize: options.pageSize });
  const t = await makeApp({
    adminFetch: backend.fetch,
    ...(options.dataDir !== undefined && { dataDir: options.dataDir }),
    ...(options.clock !== undefined && { clock: options.clock }),
  });
  await pointAt(t, FAKE_ADMIN_URL);
  return { backend, t };
}

/** Runs a titles sync now through the app's own forced refresh (it joins a run in flight). */
export const syncTitles = (t: FileserverApp): Promise<Answer> => send(t.app, "POST", "/api/library/refresh");

export const idsOf = (body: unknown): string[] =>
  (pick(body, "data.items") as Array<{ ref: { id: string } }>).map((one) => one.ref.id);

/** Follows the cursor to the end; every page that carries a cursor must hold items. */
export async function allPages(t: FileserverApp, query: string): Promise<Answer[]> {
  const pages: Answer[] = [];
  let cursor: string | undefined;
  for (let guard = 0; guard < 60; guard++) {
    const page = await send(t.app, "GET", `/api/library?${query}${cursor === undefined ? "" : `&cursor=${encodeURIComponent(cursor)}`}`);
    pages.push(page);
    const next = pick(page.body, "data.nextCursor");
    if (typeof next !== "string") return pages;
    cursor = next;
  }
  throw new Error("the cursor never ended");
}
