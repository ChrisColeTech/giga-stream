// A fake TMDB for the Library update (docs/49), served over loopback HTTP so a whole job run goes through the real client:
// `/discover/<kind>` with inclusive date filters (20 rows a page, a 400 past page 500) and, for series, the `air_date`
// filter (a series matches when its `aired` day, the day of an episode, is inside the window); `/<kind>/<id>` details with
// the series' `season/N` appends; the genre lists. Every path asked is logged (`paths`), so a test can see that nothing
// else (`/changes`) is ever requested. Any request can fail with a status or be held until released.
import http from "node:http";
import type { AddressInfo } from "node:net";
import { after } from "node:test";

import { dateFilter } from "./discover-dates.js";

type Kind = "movie" | "tv";
export interface Dated {
  id: number;
  date: string;
  /** A series with an episode on this day (`YYYY-MM-DD`) matches an `air_date` window containing it. */
  aired?: string;
}

const servers: http.Server[] = [];
after(async () => {
  for (const server of servers) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

export async function updateTmdb(data: Record<Kind, Dated[]>) {
  const state = {
    plot: new Map<number, string>(), episodes: new Map<string, number>(), noSeasonKey: new Set<string>(),
    fail: new Map<string, number>(), seasons: 2,
  };
  const log = { paths: [] as string[], discover: [] as Array<Record<string, string>>, details: [] as string[], appends: [] as string[] };
  const gates = new Map<string, { wait: Promise<void>; started: () => void }>();
  const listRow = (kind: Kind, title: Dated) => ({
    id: title.id, [kind === "movie" ? "title" : "name"]: `${kind} ${title.id}`, popularity: 50 + (title.id % 7),
    [kind === "movie" ? "release_date" : "first_air_date"]: title.date, vote_average: 7, poster_path: "/p.jpg", genre_ids: [18],
  });
  const dateOf = (kind: Kind, id: number): Dated => data[kind].find((t) => t.id === id) ?? { id, date: "2001-01-01" };

  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    log.paths.push(url.pathname);
    const json = (body: unknown, status = 200): void => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify(body));
    };
    const params = Object.fromEntries(url.searchParams);
    const page = Number(params.page ?? 1);
    let key = "";
    let answer: () => [unknown, number] = () => [{}, 404];
    const genres = /^\/genre\/(movie|tv)\/list$/.exec(url.pathname);
    const discover = /^\/discover\/(movie|tv)$/.exec(url.pathname);
    const detail = /^\/(movie|tv)\/(\d+)$/.exec(url.pathname);
    if (genres) return json({ genres: [{ id: 18, name: "Drama" }] });
    if (discover?.[1]) {
      const kind = discover[1] as Kind;
      key = `${kind}:${params["air_date.gte"] === undefined ? "discover" : "airing"}:${page}`;
      log.discover.push({ kind, ...params });
      answer = () => {
        if (page > 500) return [{ status_message: "Invalid page" }, 400];
        const inRange = dateFilter(url, kind);
        const [from, to] = [params["air_date.gte"], params["air_date.lte"]];
        const matches = (t: Dated): boolean => from !== undefined && to !== undefined
          ? t.aired !== undefined && t.aired >= from && t.aired <= to
          : t.date !== "" && inRange(t.date);
        const rows = data[kind].filter(matches);
        const results = rows.slice((page - 1) * 20, page * 20).map((t) => listRow(kind, t));
        return [{ page, results, total_pages: Math.ceil(rows.length / 20), total_results: rows.length }, 200];
      };
    } else if (detail?.[1] && detail[2]) {
      const [kind, id] = [detail[1] as Kind, Number(detail[2])];
      key = `${kind}:detail:${id}`;
      const append = (params.append_to_response ?? "").split(",").filter((a) => a !== "");
      log.details.push(key);
      log.appends.push(`${id}|${append.join(",")}`);
      const count = (n: number): number => state.episodes.get(`${id}:${n}`) ?? 1;
      answer = () => {
        const numbers = Array.from({ length: state.seasons + 1 }, (_, n) => n);
        const seasonKeys = Object.fromEntries(append.flatMap((a) => (/^season\/(\d+)$/.test(a) ? [Number(a.slice(7))] : []))
          .filter((n) => n >= 1 && n <= state.seasons && !state.noSeasonKey.has(`${id}:${n}`))
          .map((n) => [`season/${n}`, { episodes: Array.from({ length: count(n) }, (_, e) => ({ episode_number: e + 1, name: `E${e + 1}` })) }]));
        const full = append.includes("credits");
        return [{
          ...(full ? { ...listRow(kind, dateOf(kind, id)), overview: state.plot.get(id) ?? `Plot ${id} v1`, genres: [{ id: 18, name: "Drama" }],
            credits: { cast: [] }, external_ids: {}, ...(kind === "tv" && { seasons: numbers.map((n) => ({ season_number: n, episode_count: count(n) })) }) } : { id }),
          ...seasonKeys,
        }, 200];
      };
    } else return json({}, 404);
    const respond = (): void => {
      const [body, status] = answer();
      const failure = state.fail.get(key) ?? state.fail.get(key.split(":").slice(0, 2).join(":"));
      return failure === undefined ? json(body, status) : json({ status_message: "fault" }, failure);
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
    state, log,
    /** A request for this key (`movie:discover:2`, `tv:airing:1`, `movie:detail:5`) is held until `release`. */
    hold(key: string) {
      let started!: () => void;
      let release!: () => void;
      const arrived = new Promise<void>((resolve) => (started = resolve));
      gates.set(key, { wait: new Promise<void>((resolve) => (release = resolve)), started });
      return { started: arrived, release: () => { gates.delete(key); release(); } };
    },
  };
}

export type UpdateTmdb = Awaited<ReturnType<typeof updateTmdb>>;
