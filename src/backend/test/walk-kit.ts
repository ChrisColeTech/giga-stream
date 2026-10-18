// A fake TMDB for the Library fill (docs/44 sections 3.5 and 6): `/discover/<kind>` pages of two rows each, a total_pages per
// kind, a page that fails or is held until released, and `/movie/<id>` details. Plus an app on it that listens on a free port.
import http from "node:http";
import type { AddressInfo } from "node:net";
import { after } from "node:test";

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
  const state = { totals, rating: 7, poster: "/p.jpg", fail: new Map<string, number>() };
  const asked: string[] = [];
  const gates = new Map<string, { wait: Promise<void>; started: () => void }>();
  const rowOf = (kind: Kind, id: number) => ({
    id, [kind === "movie" ? "title" : "name"]: `${kind} ${id}`, release_date: "2001-01-01", first_air_date: "2001-01-01",
    vote_average: state.rating, popularity: 50 + (id % 7), poster_path: state.poster, genre_ids: [18],
  });
  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const json = (body: unknown, status = 200): void => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify(body));
    };
    const walk = /^\/discover\/(movie|tv)$/.exec(url.pathname);
    const detail = /^\/(movie|tv)\/(\d+)$/.exec(url.pathname);
    if (detail?.[1] !== undefined && detail[2] !== undefined) {
      const id = Number(detail[2]);
      asked.push(`${detail[1]}:detail:${id}`);
      return json({ ...rowOf(detail[1] as Kind, id), overview: `Plot ${id}`, genres: [{ id: 18, name: "Drama" }],
        credits: { cast: [] }, external_ids: {} });
    }
    if (walk?.[1] === undefined) return json({}, 404);
    const kind = walk[1] as Kind;
    const page = Number(url.searchParams.get("page"));
    const key = `${kind}:${page}`;
    asked.push(key);
    const respond = (): void => {
      const status = state.fail.get(key);
      if (status !== undefined) return json({ status_message: "fault" }, status);
      json({ page, results: idsOf(kind, page).map((id) => rowOf(kind, id)), total_pages: state.totals[kind], total_results: 99 });
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
    /** A request for this page is held until `release`; `started` says it arrived. */
    hold(kind: Kind, page: number) {
      let started!: () => void;
      let release!: () => void;
      const arrived = new Promise<void>((resolve) => (started = resolve));
      gates.set(`${kind}:${page}`, { wait: new Promise<void>((resolve) => (release = resolve)), started });
      return { started: arrived, release: () => { gates.delete(`${kind}:${page}`); release(); } };
    },
    /** The walk requests (not details) so far, as `kind:page`. */
    pages: (): string[] => asked.filter((entry) => !entry.includes("detail")),
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
  await api("PATCH", "/api/jobs/1", { enabled: true, config: { pages } });
  const job = async (): Promise<Record<string, unknown>> => pick((await api("GET", "/api/jobs/1")).body, "data") as Record<string, unknown>;
  const finished = (): Promise<void> => until(async () => (await job()).running === false && (await job()).lastResult !== undefined, "the run to end");
  const stored = async (): Promise<number> => Number(pick((await api("GET", "/api/titles/stored?limit=1")).body, "data.total"));
  return { t, base, token: (): string => token, api, job, finished, stored, renew };
}

export type FillApp = Awaited<ReturnType<typeof fillApp>>;
