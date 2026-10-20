import type { FakeCall } from "./fake-backend.js";
import type { Client } from "@libsql/client";

import { attachAdminDatabase, controlledDatabase, makeAdminDatabase } from "./admin-database.js";

/** A scripted stand-in for the admin backend's public title reads: an injected `fetch` that logs every call. */
export interface FakeTitle {
  id: string;
  kind?: "movie" | "tv";
  title: string;
  year?: number;
  rating?: number;
  popularity?: number;
  posterUrl?: string;
  backdropUrl?: string;
  /** What the catalog sends: TMDB genre ids as strings (decoded by the fileserver) or names. */
  genres?: string[];
}

export const DICTIONARY = {
  movie: [{ id: 28, name: "Action" }, { id: 878, name: "Science Fiction" }, { id: 35, name: "Comedy" }],
  tv: [{ id: 18, name: "Drama" }, { id: 35, name: "Comedy" }],
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const notFound = (): Response =>
  json({ ok: false, error: { code: "title.not_found", message: "no such title" } }, 404);

export function fakeTitles(initial: FakeTitle[], options: { pageSize?: number } = {}) {
  const calls: FakeCall[] = [];
  const state = {
    titles: initial,
    pageSize: options.pageSize ?? 500,
    down: false,
    genresDown: false,
    failAfterPages: undefined as number | undefined,
    stuckCursor: false,
    pagesServed: 0,
    stalled: false,
    gate: undefined as Promise<void> | undefined,
    /** Full detail payloads by id (the live answer of `GET /api/titles/:id`), and recommendations by id. */
    details: {} as Record<string, unknown>,
    recommendations: {} as Record<string, unknown[]>,
  };
  let raw: Client;
  let pending = makeAdminDatabase().then(async (database) => {
    raw = database;
    await seedGenres(database);
    await replaceTitles(database, state.titles, state.details);
    return database;
  });

  async function before(sql: string): Promise<void> {
    await pending;
    if (!/\btitles\b|title_genres/i.test(sql)) return;
    const catalogRead = /FROM titles WHERE enabled/i.test(sql);
    if (catalogRead) {
      if (state.failAfterPages !== undefined && state.pagesServed >= state.failAfterPages) {
        throw new Error("database unavailable");
      }
      state.pagesServed += 1;
      calls.push({ url: "libsql://titles/catalog", headers: new Headers(), credentials: undefined });
    } else if (/title_genres/i.test(sql)) {
      calls.push({ url: "libsql://titles/genres", headers: new Headers(), credentials: undefined });
    } else {
      calls.push({ url: "libsql://titles/read", headers: new Headers(), credentials: undefined });
    }
    if (state.gate !== undefined) await state.gate;
    if (state.stalled) await new Promise<never>(() => undefined);
    if (state.down || (state.genresDown && /title_genres/i.test(sql))) throw new Error("database unavailable");
    if (!catalogRead && !/title_genres/i.test(sql)) await applyDetails(raw, state.details);
  }

  const fetcher = attachAdminDatabase((async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const raw = String(input instanceof Request ? input.url : input);
    const url = new URL(raw);
    calls.push({ url: raw, headers: new Headers(init?.headers), credentials: init?.credentials });
    if (state.gate !== undefined) await state.gate;
    if (state.stalled) {
      await new Promise<never>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort", () => reject(new DOMException("aborted", "AbortError")), { once: true },
        );
      });
    }
    if (state.down) throw new TypeError("fetch failed");
    const path = url.pathname;
    if (path === "/api/admin/providers") {
      return json({ ok: true, data: { items: [{
        id: 2, name: "VidSrc", source: "vidsrc", is_active: true, order: 1, family: "embed",
        movieTemplate: "https://vidsrc.example/embed/movie?tmdbId={tmdbId}",
        episodeTemplate: "https://vidsrc.example/embed/tv?tmdbId={tmdbId}&season={season}&episode={episode}",
        origin: "https://vidsrc.example", created_at: "2026-10-20T00:00:00Z",
      }] } });
    }
    return notFound();
  }) as typeof fetch, async () => controlledDatabase(await pending, before));

  return {
    fetch: fetcher,
    calls,
    state,
    /** Publish a new catalog (a title missing from it is a deleted or disabled one). */
    publish(titles: FakeTitle[]): void {
      state.titles = titles;
      pending = pending.then(async () => {
        await replaceTitles(raw, titles, state.details);
        return raw;
      });
    },
    /** Hold every answer until the returned function is called (a sync is then deterministically in flight). */
    hold(): () => void {
      let release = (): void => undefined;
      state.gate = new Promise<void>((resolve) => {
        release = () => {
          state.gate = undefined;
          resolve();
        };
      });
      return release;
    },
    catalogCalls: (): FakeCall[] => calls.filter((call) => call.url.includes("titles/catalog")),
    genreCalls: (): FakeCall[] => calls.filter((call) => call.url.includes("titles/genres")),
    /** Every call that was not the catalog walk or genre dictionary. */
    otherCalls: (): FakeCall[] =>
      calls.filter((call) => !call.url.includes("titles/catalog") && !call.url.includes("titles/genres")),
  };
}

async function seedGenres(database: Client): Promise<void> {
  for (const [kind, entries] of Object.entries(DICTIONARY)) {
    for (const genre of entries) {
      await database.execute({
        sql: "INSERT INTO title_genres (kind, genre_id, name) VALUES (?, ?, ?)",
        args: [kind, genre.id, genre.name],
      });
    }
  }
}

async function replaceTitles(
  database: Client,
  titles: FakeTitle[],
  details: Record<string, unknown>,
): Promise<void> {
  const transaction = await database.transaction("write");
  try {
    await transaction.execute("DELETE FROM titles");
    for (const title of titles) {
      const kind = title.kind ?? (title.id.startsWith("tv-") ? "tv" : "movie");
      const tmdbId = Number(title.id.split("-")[1]);
      const detail = typeof details[title.id] === "object" && details[title.id] !== null
        ? details[title.id] as Record<string, unknown>
        : {};
      const payload = {
        ...detail, id: title.id, tmdbId, kind, title: title.title, genres: title.genres ?? [],
        year: title.year, rating: title.rating, posterUrl: title.posterUrl, backdropUrl: title.backdropUrl,
      };
      await transaction.execute({
        sql: `INSERT INTO titles
          (id, kind, tmdb_id, payload, popularity_score, fetched_at, origin, enabled)
          VALUES (?, ?, ?, ?, ?, 1, 'tmdb', 1)`,
        args: [title.id, kind, tmdbId, JSON.stringify(payload), title.popularity ?? null],
      });
    }
    await transaction.commit();
  } catch (error) {
    if (!transaction.closed) await transaction.rollback();
    throw error;
  }
}

async function applyDetails(database: Client, details: Record<string, unknown>): Promise<void> {
  for (const [id, payload] of Object.entries(details)) {
    const raw = (await database.execute({ sql: "SELECT payload FROM titles WHERE id = ?", args: [id] })).rows[0];
    if (raw === undefined || typeof raw.payload !== "string" || typeof payload !== "object" || payload === null) {
      continue;
    }
    const current = JSON.parse(raw.payload) as Record<string, unknown>;
    const detail = payload as Record<string, unknown>;
    const merged = {
      ...detail,
      id: current.id,
      tmdbId: current.tmdbId,
      kind: current.kind,
      title: current.title,
      genres: current.genres,
      ...(current.year !== undefined && { year: current.year }),
      ...(current.rating !== undefined && { rating: current.rating }),
      ...(current.posterUrl !== undefined && { posterUrl: current.posterUrl }),
      ...(current.backdropUrl !== undefined && { backdropUrl: current.backdropUrl }),
    };
    await database.execute({
      sql: "UPDATE titles SET payload = ? WHERE id = ?", args: [JSON.stringify(merged), id],
    });
  }
}

export type FakeTitles = ReturnType<typeof fakeTitles>;

/** A catalog of `count` movies `movie-001`... with a year and popularity that make every sort distinct. */
export function manyMovies(count: number): FakeTitle[] {
  return Array.from({ length: count }, (_, at) => ({
    id: `movie-${String(at + 1).padStart(3, "0")}`,
    title: `Movie ${String(at + 1).padStart(3, "0")}`,
    year: 1990 + (at % 30),
    popularity: at + 1,
    genres: [at % 2 === 0 ? "28" : "878"],
  }));
}
