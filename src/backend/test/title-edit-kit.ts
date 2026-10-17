/** A TMDB stub whose answers the test changes between syncs, and the app setup the title-edit tests share. */
import http from "node:http";
import type { AddressInfo } from "node:net";
import { after } from "node:test";

import { makeApp, pick, send, signIn } from "./test-app.js";
import { settled } from "./title-stubs.js";

export const FOUR_DAYS_MS = 4 * 24 * 60 * 60 * 1000;

const servers: http.Server[] = [];
after(async () => {
  for (const server of servers) await new Promise<void>((resolve) => server.close(() => resolve()));
});

/** What TMDB currently says about Matrix (movie 603); change it to make a later sync differ. */
export interface MatrixState {
  title: string;
  plot: string;
  rating: number;
  runtime: number;
}

export async function mutableTmdb() {
  const state: MatrixState = { title: "The Matrix", plot: "TMDB plot v1", rating: 8.2, runtime: 136 };
  const calls: string[] = [];
  const listRow = () => ({
    id: 603, title: state.title, release_date: "1999-03-31", vote_average: state.rating, popularity: 90,
    poster_path: "/matrix.jpg", genre_ids: [878],
  });
  const tvRow = { id: 1399, name: "Game of Thrones", first_air_date: "2011-04-17", vote_average: 8.4, popularity: 120, genre_ids: [18] };
  const page = (results: unknown[]) => ({ page: 1, results, total_pages: 1, total_results: results.length });
  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    calls.push(url.pathname);
    const json = (body: unknown, status = 200): void => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify(body));
    };
    const p = url.pathname;
    if (p === "/movie/603") {
      return json({
        ...listRow(), overview: state.plot, runtime: state.runtime, genres: [{ id: 878, name: "Science Fiction" }],
        credits: { cast: [{ name: "Keanu Reeves" }] }, external_ids: { imdb_id: "tt0133093" },
      });
    }
    if (p === "/tv/1399") {
      return json({ ...tvRow, genres: [{ id: 18, name: "Drama" }], credits: { cast: [] }, external_ids: {} });
    }
    if (["/discover/movie", "/search/movie", "/trending/movie/week", "/movie/popular"].includes(p)) return json(page([listRow()]));
    if (["/discover/tv", "/search/tv", "/trending/tv/week", "/tv/popular"].includes(p)) return json(page([tvRow]));
    if (p === "/movie/603/recommendations" || p === "/tv/1399/recommendations") return json(page([]));
    return json({ status_message: "not found" }, 404);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  servers.push(server);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { base, calls, state };
}

/** An app that talks to the stub TMDB, and an owner's token for it. */
export async function titleApp(options: { tmdb?: boolean } = {}) {
  const tmdb = await mutableTmdb();
  const t = await makeApp({ config: options.tmdb === false ? {} : { TMDB_READ_TOKEN: "test-token", TMDB_BASE: tmdb.base } });
  const token = (await signIn(t.app)).access;
  return { t, tmdb, token };
}

type Harness = Awaited<ReturnType<typeof titleApp>>;

/** A bulk sync, waited for. */
export async function syncAll(h: Harness, body: Record<string, unknown>): Promise<void> {
  const token = (await signIn(h.t.app)).access;
  const started = await send(h.t.app, "POST", "/api/titles/sync", body, token);
  if (started.status !== 202) throw new Error(`sync refused: ${JSON.stringify(started.body)}`);
  await settled(h.t);
}

/** The app's clock moves on, so every token is signed in again. */
export async function later(h: Harness, ms: number): Promise<string> {
  h.t.clock.advance(ms);
  return (await signIn(h.t.app)).access;
}

export const field = (answer: { body: unknown }, name: string): unknown => pick(answer.body, `data.${name}`);
