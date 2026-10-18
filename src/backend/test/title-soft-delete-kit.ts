/** Helpers for the soft-delete tests: the audit actions, and a TMDB stub with several rows on several pages. */
import http from "node:http";
import type { AddressInfo } from "node:net";
import { after } from "node:test";

import { pick, send, type TestApp } from "./test-app.js";

/** The audit log's actions, newest first. */
export async function actionsOf(t: TestApp, token: string): Promise<string[]> {
  const items = pick((await send(t.app, "GET", "/api/audit?limit=20", undefined, token)).body, "data.items");
  return (items as Array<Record<string, unknown>>).map((entry) => String(entry.action));
}

const servers: http.Server[] = [];
after(async () => {
  for (const server of servers) await new Promise<void>((resolve) => server.close(() => resolve()));
});

const row = (id: number, title: string) => ({
  id, title, release_date: "2000-01-01", vote_average: 7, popularity: 10, poster_path: "/p.jpg", genre_ids: [18],
});

/** `/discover/movie` answers three pages of three titles: A1 to A3 (ids 101 to 103), B1 to B3, C1 to C3. */
export async function pagedTmdb() {
  const calls: string[] = [];
  const pages = ["A", "B", "C"].map((letter, at) =>
    [1, 2, 3].map((n) => row(101 + at * 10 + (n - 1), `${letter}${n}`)),
  );
  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    calls.push(url.pathname);
    const page = Number(url.searchParams.get("page") ?? "1");
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ page, results: pages[page - 1] ?? [], total_pages: 3, total_results: 9 }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  servers.push(server);
  return { base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, calls };
}
