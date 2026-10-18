import http from "node:http";
import type { AddressInfo } from "node:net";
import { after } from "node:test";

import { makeApp, pick, send, signIn } from "./test-app.js";

/** Hand-written TMDB- and OMDb-shaped answers (docs/11 section 6), served by local stubs. */
const MATRIX = {
  id: 603,
  title: "The Matrix",
  overview: "A computer hacker learns the true nature of reality.",
  release_date: "1999-03-31",
  vote_average: 8.2,
  popularity: 90,
  poster_path: "/matrix.jpg",
  backdrop_path: "/matrix-b.jpg",
  runtime: 136,
  genres: [{ id: 878, name: "Science Fiction" }],
  credits: { cast: [{ name: "Keanu Reeves" }, { name: "Laurence Fishburne" }] },
  external_ids: { imdb_id: "tt0133093" },
};

const GOT_DETAIL = {
  id: 1399,
  name: "Game of Thrones",
  first_air_date: "2011-04-17",
  vote_average: 8.4,
  popularity: 120,
  poster_path: "/got.jpg",
  genres: [{ id: 18, name: "Drama" }],
  credits: { cast: [{ name: "Peter Dinklage" }] },
  external_ids: { imdb_id: "tt0944947" },
  seasons: [
    { season_number: 0, episode_count: 5, air_date: "2010-12-05" },
    { season_number: 1, episode_count: 10, air_date: "2011-04-17" },
    { season_number: 2, episode_count: 0, air_date: "2012-04-01" },
  ],
};

const OMDB_MATRIX = {
  Title: "The Matrix",
  Year: "1999",
  Rated: "R",
  Metascore: "73",
  imdbRating: "8.7",
  imdbVotes: "2.1M",
  Ratings: [
    { Source: "Internet Movie Database", Value: "8.7/10" },
    { Source: "Rotten Tomatoes", Value: "83%" },
    { Source: "Metacritic", Value: "73/100" },
  ],
  Awards: "Won 4 Oscars. 42 wins & 52 nominations total",
  BoxOffice: "$177,559,005",
  Director: "Lana Wachowski, Lilly Wachowski",
  Writer: "The Wachowskis",
  Language: "English",
  Country: "United States",
  Plot: "When a beautiful stranger leads computer hacker Neo to a forbidding underworld...",
  Response: "True",
};

const LIST_ROW = {
  id: 603,
  title: "The Matrix",
  release_date: "1999-03-31",
  vote_average: 8.2,
  popularity: 90,
  poster_path: "/matrix.jpg",
  genre_ids: [878],
};

const TV_LIST_ROW = {
  id: 1399,
  name: "Game of Thrones",
  first_air_date: "2011-04-17",
  vote_average: 8.4,
  popularity: 120,
  poster_path: "/got.jpg",
  genre_ids: [18],
};

const SEASON = {
  episodes: [{ episode_number: 1, name: "Winter Is Coming", air_date: "2011-04-17", runtime: 62 }],
};

const stubs: Array<() => Promise<void>> = [];
after(async () => {
  for (const close of stubs) await close();
});

/** Serves `handle` on a free loopback port until the file's tests end. */
async function serve(handle: (url: URL, json: (body: unknown, status?: number) => void) => void): Promise<string> {
  const server = http.createServer((request, response) => {
    const json = (body: unknown, status = 200): void => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify(body));
    };
    handle(new URL(request.url ?? "/", "http://localhost"), json);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  stubs.push(() => new Promise<void>((resolve) => server.close(() => resolve())));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

interface TmdbStubOptions {
  movieRows?: unknown[];
  tvRows?: unknown[];
  recommendationRows?: unknown[];
}

/** A stub TMDB: records request keys, answers the paths the service calls. */
export async function stubTmdb(options: TmdbStubOptions = {}) {
  const calls: string[] = [];
  const movieRows = options.movieRows ?? [LIST_ROW];
  const tvRows = options.tvRows ?? [TV_LIST_ROW];
  const page = (url: URL, results: unknown[]) => ({
    page: url.searchParams.get("page"),
    results,
    total_pages: 1,
    total_results: results.length,
  });
  const base = await serve((url, json) => {
    calls.push(url.pathname + url.search);
    const p = url.pathname;
    if (p === "/movie/603") return json(MATRIX);
    if (p === "/tv/1399") {
      // TMDB's append_to_response=season/N answers each appended season under its `season/N` key.
      const appended = (url.searchParams.get("append_to_response") ?? "").split(",");
      return json({ ...GOT_DETAIL, ...(appended.includes("season/1") && { "season/1": SEASON }) });
    }
    if (p === "/discover/movie") return json({ ...page(url, movieRows), page: 1 });
    if (p === "/discover/tv") return json({ ...page(url, tvRows), page: 1 });
    if (p === "/search/movie") return json(page(url, movieRows));
    if (p === "/search/tv") return json(page(url, tvRows));
    if (p === "/trending/movie/week" || p === "/movie/popular") return json(page(url, movieRows));
    if (p === "/trending/tv/week" || p === "/tv/popular") return json(page(url, tvRows));
    if (p === "/genre/movie/list") return json({ genres: [{ id: 878, name: "Science Fiction" }] });
    if (p === "/genre/tv/list") return json({ genres: [{ id: 18, name: "Drama" }] });
    if (p === "/tv/1399/season/1") return json(SEASON);
    if (p === "/movie/603/recommendations" || p === "/tv/1399/recommendations") {
      const results = options.recommendationRows ?? [{ ...LIST_ROW, id: 1399, title: "Game of Thrones" }];
      return json({ page: 1, results, total_pages: 1, total_results: results.length });
    }
    return json({ status_message: "not found" }, 404);
  });
  return { base, calls };
}

/** A TMDB that answers 500 to anything and records the call: a test asserts `calls` stays empty. */
export async function forbiddenTmdb() {
  const calls: string[] = [];
  const base = await serve((url, json) => {
    calls.push(url.pathname + url.search);
    json({ status_message: "no TMDB call is allowed here" }, 500);
  });
  return { base, calls };
}

/** A stub OMDb: records the apikey and id of every call, answers the envelope OMDb really sends. */
export async function stubOmdb() {
  const calls: string[] = [];
  const base = await serve((url, json) => {
    calls.push(`${url.searchParams.get("i")}|key=${url.searchParams.get("apikey")}`);
    if (url.searchParams.get("apikey") !== "omdb-test-key") return json({ Response: "False", Error: "Invalid API key!" });
    if (url.searchParams.get("i") === "tt0133093") return json(OMDB_MATRIX);
    return json({ Response: "False", Error: "Error getting data." });
  });
  return { base, calls };
}

export const tmdbOn = (tmdb: { base: string }) => ({ TMDB_READ_TOKEN: "test-token", TMDB_BASE: tmdb.base });

export const omdbOn = (tmdb: { base: string }, omdb: { base: string }) => ({
  ...tmdbOn(tmdb),
  OMDB_API_KEY: "omdb-test-key",
  OMDB_BASE: omdb.base,
});

/** The Library fill, run and waited for: job 1 is enabled at one page a kind and started as `POST /api/titles/sync` does. */
export async function fillLibrary(t: Awaited<ReturnType<typeof makeApp>>): Promise<void> {
  const access = (await signIn(t.app)).access;
  await send(t.app, "PATCH", "/api/jobs/1", { enabled: true, config: { pages: 1 } }, access);
  const started = await send(t.app, "POST", "/api/titles/sync", undefined, access);
  if (started.status !== 202) throw new Error(`sync refused: ${JSON.stringify(started.body)}`);
  await settled(t);
}

/** Resolves once no sync job is running (reads the status endpoint with a sign-in). */
export async function settled(t: Awaited<ReturnType<typeof makeApp>>): Promise<void> {
  const access = (await signIn(t.app)).access;
  for (let i = 0; i < 400; i++) {
    const status = await send(t.app, "GET", "/api/titles/sync", undefined, access);
    if (pick(status.body, "data.running") === false) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("the sync job never settled");
}
