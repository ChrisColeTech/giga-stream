// A fake TMDB for the Library update (docs/49), served over loopback HTTP so a whole job run goes through the real client:
// `/discover/<kind>` with inclusive date filters (20 rows a page, a 400 past page 500), `/<kind>/changes` as TMDB serves it
// (inclusive days, 100 ids a page, a 422 for a range over 14 days, a 400 past page 500), `/<kind>/<id>` details with the
// series' `season/N` appends, and the genre lists. Changed ids come per day: listed ids, or a count of generated ones
// (served lazily, so a window of 60,000 ids costs nothing). Any request can fail with a status or be held until released.
import http from "node:http";
import type { AddressInfo } from "node:net";
import { after } from "node:test";

import { dateFilter } from "./discover-dates.js";

type Kind = "movie" | "tv";
export interface Dated {
  id: number;
  date: string;
}

const DAY_MS = 86_400_000;
const dayNo = (iso: string): number => Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);
const servers: http.Server[] = [];
after(async () => {
  for (const server of servers) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

export async function updateTmdb(data: Record<Kind, Dated[]>) {
  const maps = () => ({ movie: new Map<string, number[]>(), tv: new Map<string, number[]>() });
  const state = {
    /** The ids edited on a day (`YYYY-MM-DD`), per kind, and how many generated ids that day also has. */
    changed: maps(), bulk: { movie: new Map<string, number>(), tv: new Map<string, number>() },
    plot: new Map<number, string>(), episodes: new Map<string, number>(), noSeasonKey: new Set<string>(),
    fail: new Map<string, number>(), seasons: 2,
  };
  const log = {
    discover: [] as Array<Record<string, string>>, changes: [] as Array<Record<string, string> & { kind: Kind }>,
    details: [] as string[], appends: [] as string[],
  };
  const gates = new Map<string, { wait: Promise<void>; started: () => void }>();
  const listRow = (kind: Kind, title: Dated) => ({
    id: title.id, [kind === "movie" ? "title" : "name"]: `${kind} ${title.id}`, popularity: 50 + (title.id % 7),
    [kind === "movie" ? "release_date" : "first_air_date"]: title.date, vote_average: 7, poster_path: "/p.jpg", genre_ids: [18],
  });
  const dateOf = (kind: Kind, id: number): Dated => data[kind].find((t) => t.id === id) ?? { id, date: "2001-01-01" };

  /** The ids of every day in the window, once each: listed ones first, then each day's generated block. */
  function changedIds(kind: Kind, from: string, to: string) {
    const listed = new Set<number>();
    const blocks: Array<{ base: number; count: number }> = [];
    for (let day = dayNo(from); day <= dayNo(to); day++) {
      const iso = new Date(day * DAY_MS).toISOString().slice(0, 10);
      for (const id of state.changed[kind].get(iso) ?? []) listed.add(id);
      const count = state.bulk[kind].get(iso) ?? 0;
      if (count > 0) blocks.push({ base: 10_000_000 + (day % 1000) * 100_000, count });
    }
    const explicit = [...listed];
    const total = explicit.length + blocks.reduce((sum, b) => sum + b.count, 0);
    const at = (index: number): number => {
      if (index < explicit.length) return explicit[index] ?? 0;
      let rest = index - explicit.length;
      for (const block of blocks) {
        if (rest < block.count) return block.base + rest;
        rest -= block.count;
      }
      return 0;
    };
    return { total, at };
  }

  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
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
    const changes = /^\/(movie|tv)\/changes$/.exec(url.pathname);
    const detail = /^\/(movie|tv)\/(\d+)$/.exec(url.pathname);
    if (genres) return json({ genres: [{ id: 18, name: "Drama" }] });
    if (discover?.[1]) {
      const kind = discover[1] as Kind;
      key = `${kind}:discover:${page}`;
      log.discover.push({ kind, ...params });
      answer = () => {
        if (page > 500) return [{ status_message: "Invalid page" }, 400];
        const inRange = dateFilter(url, kind);
        const rows = data[kind].filter((t) => t.date !== "" && inRange(t.date));
        const results = rows.slice((page - 1) * 20, page * 20).map((t) => listRow(kind, t));
        return [{ page, results, total_pages: Math.ceil(rows.length / 20), total_results: rows.length }, 200];
      };
    } else if (changes?.[1]) {
      const kind = changes[1] as Kind;
      key = `${kind}:changes:${page}`;
      log.changes.push({ kind, ...params });
      answer = () => {
        const [from, to] = [params.start_date ?? "", params.end_date ?? ""];
        if (dayNo(to) - dayNo(from) > 14) return [{ status_message: "Invalid date range: no longer than 14 days." }, 422];
        if (page > 500) return [{ status_message: "Invalid page: max at 500" }, 400];
        const ids = changedIds(kind, from, to);
        const results = Array.from({ length: Math.max(0, Math.min(100, ids.total - (page - 1) * 100)) },
          (_, i) => ({ id: ids.at((page - 1) * 100 + i), adult: false }));
        return [{ page, results, total_pages: Math.ceil(ids.total / 100), total_results: ids.total }, 200];
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
    /** A request for this key (`movie:discover:2`, `tv:changes:1`, `movie:detail:5`) is held until `release`. */
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
