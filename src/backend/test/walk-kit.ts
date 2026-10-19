// A fake TMDB for the Library fill (docs/44 sections 3.5 and 6, docs/47): `/discover/<kind>` pages of two rows each, a
// total_pages per kind, `/movie|tv/<id>` details, a series' `append_to_response=season/N` episodes and the genre lists. Any request can
// fail with a status or be held until released (keys: `movie:2` a page, `movie:detail:1010`).
// Plus an app on it that listens on a free port.
import http from "node:http";
import type { AddressInfo } from "node:net";
import { after } from "node:test";

import { datedIn } from "./discover-dates.js";
import { until } from "./playlist-kit.js";
import { makeApp, pick, send, signIn, type TestApp } from "./test-app.js";

type Kind = "movie" | "tv";
const ROWS_PER_PAGE = 2;
const servers: http.Server[] = [];
after(async () => {
  for (const server of servers) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

/** The ids a page holds: movies 1000 + 10 * page + row, series 2000 + the same. */
export const idsOf = (kind: Kind, page: number): number[] =>
  Array.from({ length: ROWS_PER_PAGE }, (_, row) => (kind === "movie" ? 1000 : 2000) + page * 10 + row);

export async function walkTmdb(totals: Record<Kind, number>) {
  const state = {
    totals, rating: 7, poster: "/p.jpg", fail: new Map<string, number>(), seasonCount: 2, noSeasonKey: new Set<string>(),
    /** Every detail carries the IMDb id `tt<id>` (the OMDb step asks by it). */
    imdb: false,
    /** A movie's runtime in minutes (TMDB answers none by default). */
    runtime: undefined as number | undefined,
    /** Per detail id, the TMDB fields left out of the answer: `overview`, `genres`, `vote_average`, `runtime`. */
    bare: new Map<number, string[]>(),
  };
  const asked: string[] = [];
  const gates = new Map<string, { wait: Promise<void>; started: () => void }>();
  const rowOf = (kind: Kind, id: number) => ({
    id, [kind === "movie" ? "title" : "name"]: `${kind} ${id}`, release_date: "2001-01-01", first_air_date: "2001-01-01",
    vote_average: state.rating, popularity: 50 + (id % 7), poster_path: state.poster, genre_ids: [18],
  });
  /** A series has `state.seasonCount` seasons (plus the specials), one episode each; `state.noSeasonKey` is never answered. */
  const seasonsOf = () => Array.from({ length: state.seasonCount + 1 }, (_, n) => ({ season_number: n, episode_count: 1 }));
  const appends: string[] = [];
  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const json = (body: unknown, status = 200): void => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify(body));
    };
    const walk = /^\/discover\/(movie|tv)$/.exec(url.pathname);
    const detail = /^\/(movie|tv)\/(\d+)$/.exec(url.pathname);
    const genres = /^\/genre\/(movie|tv)\/list$/.test(url.pathname);
    let key = "";
    let answer: () => unknown = () => ({});
    if (genres) return json({ genres: [{ id: 18, name: "Drama" }] });
    if (detail?.[1] !== undefined && detail[2] !== undefined) {
      const [kind, id] = [detail[1] as Kind, Number(detail[2])];
      key = `${kind}:detail:${id}`;
      const append = (url.searchParams.get("append_to_response") ?? "").split(",").filter((a) => a !== "");
      appends.push(`${id}|${append.join(",")}`);
      // Each appended `season/N` that exists is answered under its own key, as TMDB does.
      const requested = append.flatMap((a) => (/^season\/(\d+)$/.exec(a)?.[1] ? [Number(a.slice(7))] : []));
      const seasonKeys = Object.fromEntries(requested.filter((n) => n >= 0 && n <= state.seasonCount && !state.noSeasonKey.has(`${id}:${n}`))
        .map((n) => [`season/${n}`, { episodes: [{ episode_number: 1, name: `Episode ${id}/${n}`, air_date: "2001-01-01", runtime: 40 }] }]));
      const withCredits = append.includes("credits");
      const without = (full: Record<string, unknown>): Record<string, unknown> =>
        Object.fromEntries(Object.entries(full).filter(([name]) => !(state.bare.get(id) ?? []).includes(name)));
      answer = () => ({
        ...(withCredits ? without({ ...rowOf(kind, id), overview: `Plot ${id}`, genres: [{ id: 18, name: "Drama" }], credits: { cast: [] },
          external_ids: state.imdb ? { imdb_id: `tt${id}` } : {}, ...(kind === "tv" && { seasons: seasonsOf() }),
          ...(kind === "movie" && state.runtime !== undefined && { runtime: state.runtime }) }) : { id }),
        ...seasonKeys,
      });
    } else if (walk?.[1] !== undefined) {
      const kind = walk[1] as Kind;
      // The sliced walk (docs/48) asks every year; every row here is dated 2001-01-01, so the other slices are empty
      // and, being only the walk's way of looking, are not recorded.
      if (!datedIn(url, kind, "2001-01-01")) return json({ page: 1, results: [], total_pages: 0, total_results: 0 });
      const page = Number(url.searchParams.get("page"));
      key = `${kind}:${page}`;
      answer = () => ({ page, results: idsOf(kind, page).map((id) => rowOf(kind, id)), total_pages: state.totals[kind], total_results: 99 });
    } else return json({}, 404);
    asked.push(key);
    const respond = (): void => {
      const status = state.fail.get(key);
      return status !== undefined ? json({ status_message: "fault" }, status) : json(answer());
    };
    const gate = gates.get(key);
    if (gate === undefined) return respond();
    gate.started();
    void gate.wait.then(respond);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  servers.push(server);
  return {
    base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    state,
    asked,
    /** A request for this key is held until `release`; `started` says it arrived. */
    hold(kind: Kind, page: number | string) {
      const key = `${kind}:${page}`;
      let started!: () => void;
      let release!: () => void;
      const arrived = new Promise<void>((resolve) => (started = resolve));
      gates.set(key, { wait: new Promise<void>((resolve) => (release = resolve)), started });
      return { started: arrived, release: () => { gates.delete(key); release(); } };
    },
    /** The walk requests (not details or seasons) so far, as `kind:page`. */
    pages: (): string[] => asked.filter((entry) => !entry.includes("detail")),
    /** The detail calls so far, as `kind:detail:id`, and what each asked to append, as `id|credits,external_ids,season/1,...`. */
    details: (): string[] => asked.filter((entry) => entry.includes("detail")),
    appends,
  };
}

export type WalkTmdb = Awaited<ReturnType<typeof walkTmdb>>;

/** An app on `tmdb`, listening on a free loopback port, with its Library fill (job 1) enabled at `pages` a kind. */
export async function fillApp(tmdb: WalkTmdb, pages: number, config: Record<string, unknown> = {}) {
  const t: TestApp = await makeApp({ config: { TMDB_READ_TOKEN: "test-token", TMDB_BASE: tmdb.base, ...config } });
  const base = await t.app.listen({ port: 0, host: "127.0.0.1" });
  let token = (await signIn(t.app)).access;
  const renew = async (): Promise<void> => void (token = (await signIn(t.app)).access);
  const api = (method: "GET" | "POST" | "PATCH" | "DELETE", url: string, body?: unknown) => send(t.app, method, url, body, token);
  await api("PATCH", "/api/admin/jobs/1", { enabled: true, config: { pages } });
  await api("PATCH", "/api/admin/jobs/2", { schedule: "off" }); // the seeded Library update must not start by itself (docs/49)
  const job = async (): Promise<Record<string, unknown>> => pick((await api("GET", "/api/admin/jobs/1")).body, "data") as Record<string, unknown>;
  const finished = (): Promise<void> => until(async () => (await job()).running === false && (await job()).lastResult !== undefined, "the run to end");
  const stored = async (): Promise<number> => Number(pick((await api("GET", "/api/admin/titles/stored?limit=1")).body, "data.total"));
  return { t, base, token: (): string => token, api, job, finished, stored, renew };
}

export type FillApp = Awaited<ReturnType<typeof fillApp>>;
