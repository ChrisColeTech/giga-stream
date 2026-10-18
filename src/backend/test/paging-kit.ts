/** Seeds for the paging tests (docs/41 section 3.4): rows written straight into a temporary store before the app opens. */
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after } from "node:test";

import { DATABASE_FILE_NAME } from "../src/constants/deployment.js";
import { createStore } from "../src/store/store.js";
import { NOT_SYNCED, type StreamRecord } from "../src/types/channel.js";
import { pick } from "./test-app.js";

const dirs: string[] = [];
after(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

/** A temporary data folder holding a migrated store that `seed` filled; the app is then opened on it. */
export function seededDataDir(seed: (store: ReturnType<typeof createStore>) => void): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "giga-backend-paging-"));
  dirs.push(dir);
  const store = createStore(path.join(dir, DATABASE_FILE_NAME));
  try {
    seed(store);
  } finally {
    store.close();
  }
  return dir;
}

/** The two web playlists the stream rows belong to (ids 1 and 2): a name that is not the host, so a search tells them apart. */
export const PLAYLISTS = [
  { id: 1, name: "Alpha list", host: "a.example" },
  { id: 2, name: "Beta list", host: "b.example" },
] as const;

/**
 * 250 stream rows: 100 in the playlist on `a.example`, 100 in the one on `b.example`, 50 hand-made; every tenth has no
 * number; every seventh playlist row is edited; every fifth is disabled; row 3's name holds a literal `%`. `source` and
 * `playlistName` are what a read derives from the playlist; the store ignores them on a write.
 */
export function streamRows(): StreamRecord[] {
  return Array.from({ length: 250 }, (_, i): StreamRecord => {
    const owner = i < 100 ? PLAYLISTS[0] : i < 200 ? PLAYLISTS[1] : undefined;
    return {
      ...NOT_SYNCED,
      kind: "stream",
      id: `ch_${String(i).padStart(3, "0")}`,
      name: i === 3 ? "Channel 3 100% Live" : `Channel ${i}`,
      category: ["News", "sports", "Movies"][i % 3] ?? "News",
      number: i % 10 === 9 ? null : String(i + 1),
      logoUrl: null,
      revision: 1,
      enabled: i % 5 !== 0,
      published: i % 5 !== 0,
      streamUrl: `https://s.example/${i}.m3u8`,
      tvgId: `tvg.${i}`,
      source: owner?.host ?? null,
      playlistName: owner?.name ?? null,
      syncName: owner === undefined ? null : `Channel ${i}`,
      playlistId: owner?.id ?? null,
      editedFields: owner !== undefined && i % 7 === 0 ? ["name"] : [],
    };
  });
}

/** Writes the two playlists, then the stream rows that belong to them. */
export function seedStreams(store: ReturnType<typeof createStore>): void {
  for (const p of PLAYLISTS) store.playlists.insert({ kind: "url", name: p.name, url: `https://${p.host}/list.m3u`, host: p.host, enabled: true }, 1);
  for (const row of streamRows()) store.channels.insert(row, 1);
}

export interface SeedTitle {
  id: string;
  kind: "movie" | "tv";
  origin: "tmdb" | "manual";
  title: string;
  year?: number;
  rating?: number;
  edited: boolean;
  enabled: boolean;
  fetchedAt: number;
}

const TITLE_AT = Date.UTC(2026, 0, 1);

/** 150 titles: movie and tv, every tenth made by hand, every eighth synced one edited, every ninth disabled. */
export function seedTitles(): SeedTitle[] {
  return Array.from({ length: 150 }, (_, i): SeedTitle => {
    const kind = i % 2 === 0 ? "movie" : "tv";
    const origin = i % 10 === 0 ? "manual" : "tmdb";
    const title = i === 5 ? "50% Off" : i === 7 ? "Under_Score" : i === 11 ? "the matrix" : i === 12 ? "THE MATRIX II" : `Title ${i}`;
    return {
      id: origin === "manual" ? `custom-${String(i).padStart(3, "0")}` : `${kind}-${1000 + i}`,
      kind, origin, title,
      ...(i % 13 !== 0 && { year: 1950 + (i % 70) }),
      ...(i % 17 !== 0 && { rating: (i % 50) / 5 }),
      edited: origin === "tmdb" && i % 8 === 0,
      enabled: i % 9 !== 0,
      // Every third shares a time with its neighbour: the id decides the tie.
      fetchedAt: TITLE_AT + Math.floor(i / 3) * 1000,
    };
  });
}

export function writeTitles(store: ReturnType<typeof createStore>, titles: readonly SeedTitle[]): void {
  for (const t of titles) {
    const tmdbId = Number(t.id.split("-")[1]);
    const payload = { id: t.id, kind: t.kind, shape: "list", title: t.title, year: t.year, rating: t.rating, genres: ["Drama"] };
    if (t.origin === "manual") store.titles.insertManual({ id: t.id, kind: t.kind, tmdbId: null, payload, at: t.fetchedAt });
    else store.titles.put({ kind: t.kind, tmdbId, payload, popularityScore: null, popularityReadAt: null, fetchedAt: t.fetchedAt });
    if (t.edited || !t.enabled) {
      const editedFields = t.edited ? ["title"] : [];
      store.titles.updateRecord(t.id, { payload, editedFields, tmdbId: t.origin === "manual" ? null : tmdbId, enabled: t.enabled });
    }
  }
}

/** The `data` of a page answer, with its items as plain records. */
export function pageOf(body: unknown) {
  const items = pick(body, "data.items");
  if (!Array.isArray(items)) throw new Error(`not a page: ${JSON.stringify(body)}`);
  return {
    items: items.map((item): Record<string, unknown> => ({ ...(item as Record<string, unknown>) })),
    total: Number(pick(body, "data.total")),
    data: pick(body, "data") as Record<string, unknown>,
  };
}
