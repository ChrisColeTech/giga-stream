// A fake OMDb for the Library fill (docs/11 section 7): answers any `tt<id>` the way OMDb's envelope does, records the ids it
// was asked for, can miss chosen ids, answer "Request limit reached." after N calls, or hold one id until released.
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { after } from "node:test";
import { DatabaseSync } from "node:sqlite";

import { DATABASE_FILE_NAME } from "../src/constants/deployment.js";
import type { TestApp } from "./test-app.js";

export const OMDB_KEY = "omdb-test-key";
const servers: http.Server[] = [];
after(async () => {
  for (const server of servers) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

export async function fakeOmdb() {
  const calls: string[] = [];
  const state = { miss: new Set<string>(), limitAfter: undefined as number | undefined,
    /** Fields of the answer replaced (`{ imdbRating: "N/A" }`). */
    answer: {} as Record<string, unknown> };
  const gates = new Map<string, { wait: Promise<void>; started: () => void }>();
  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const id = url.searchParams.get("i") ?? "";
    const json = (body: unknown): void => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(body));
    };
    calls.push(id);
    const respond = (): void => {
      if (url.searchParams.get("apikey") !== OMDB_KEY) return json({ Response: "False", Error: "Invalid API key!" });
      if (state.limitAfter !== undefined && calls.length > state.limitAfter) return json({ Response: "False", Error: "Request limit reached." });
      if (state.miss.has(id)) return json({ Response: "False", Error: "Error getting data." });
      json({
        Response: "True", Title: `Title ${id}`, Rated: "PG-13", Metascore: "73", imdbRating: "8.7", imdbVotes: "2.1M",
        Ratings: [{ Source: "Internet Movie Database", Value: "8.7/10" }, { Source: "Rotten Tomatoes", Value: "83%" }],
        Awards: "Won 4 Oscars.", BoxOffice: "$177,559,005", Director: "A Director", Writer: "A Writer",
        Language: "English", Country: "United States", Plot: `A full OMDb plot for ${id}.`,
        Runtime: "120 min", Genre: "Drama, Mystery", ...state.answer,
      });
    };
    const gate = gates.get(id);
    if (gate === undefined) return respond();
    gate.started();
    void gate.wait.then(respond);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  servers.push(server);
  return {
    base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    calls,
    state,
    /** The call for this IMDb id is held until `release`; `started` says it arrived. */
    hold(imdbId: string) {
      let started!: () => void;
      let release!: () => void;
      const arrived = new Promise<void>((resolve) => (started = resolve));
      gates.set(imdbId, { wait: new Promise<void>((resolve) => (release = resolve)), started });
      return { started: arrived, release: () => { gates.delete(imdbId); release(); } };
    },
  };
}

export type FakeOmdb = Awaited<ReturnType<typeof fakeOmdb>>;

/** The app config that turns OMDb on, against `omdb`; `limit` is the day's budget (the client keeps a headroom of 10). */
export const omdbConfig = (omdb: FakeOmdb, limit?: number): Record<string, unknown> => ({
  OMDB_API_KEY: OMDB_KEY, OMDB_BASE: omdb.base, ...(limit !== undefined && { OMDB_DAILY_LIMIT: limit }),
});

/** One column of one title, read from the store file (read-only). */
export function column(t: TestApp, id: string, name: "omdb_failed_at"): unknown {
  const db = new DatabaseSync(path.join(t.dataDir, DATABASE_FILE_NAME), { readOnly: true });
  try {
    return db.prepare(`SELECT ${name} AS v FROM titles WHERE id = ?`).get(id)?.v;
  } finally {
    db.close();
  }
}
