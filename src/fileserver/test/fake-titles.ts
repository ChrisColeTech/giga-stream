import type { FakeCall } from "./fake-backend.js";

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
const notFound = (): Response => json({ ok: false, error: { code: "title.not_found", message: "no such title" } }, 404);

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

  function catalog(url: URL): Response {
    if (state.failAfterPages !== undefined && state.pagesServed >= state.failAfterPages) throw new TypeError("fetch failed");
    state.pagesServed += 1;
    const after = url.searchParams.get("after");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? "500"), state.pageSize);
    const sorted = [...state.titles].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const rest = after === null ? sorted : sorted.filter((one) => one.id > after);
    const page = rest.slice(0, limit);
    const more = rest.length > limit;
    const items = page.map((one) => ({ ...one, kind: one.kind ?? (one.id.startsWith("tv-") ? "tv" : "movie"), genres: one.genres ?? [] }));
    const last = page.at(-1)?.id;
    const next = state.stuckCursor && (more || after !== null) ? (after ?? last) : more ? last : undefined;
    return json({ ok: true, data: { items, ...(next !== undefined && { next }) } });
  }

  const fetcher = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const raw = String(input instanceof Request ? input.url : input);
    const url = new URL(raw);
    calls.push({ url: raw, headers: new Headers(init?.headers), credentials: init?.credentials });
    if (state.gate !== undefined) await state.gate;
    if (state.stalled) {
      await new Promise<never>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
      });
    }
    if (state.down) throw new TypeError("fetch failed");
    const path = url.pathname;
    if (path === "/api/channels") return json({ ok: true, data: { items: [], revision: 1 } });
    if (path === "/api/titles/catalog") return catalog(url);
    if (path === "/api/titles/genres") {
      if (state.genresDown) throw new TypeError("fetch failed");
      return json({ ok: true, data: url.searchParams.get("kind") === "tv" ? DICTIONARY.tv : DICTIONARY.movie });
    }
    const recommended = /^\/api\/titles\/([^/]+)\/recommendations$/.exec(path);
    if (recommended !== null) return json({ ok: true, data: { items: state.recommendations[recommended[1] ?? ""] ?? [] } });
    const detail = /^\/api\/titles\/([^/]+)$/.exec(path);
    if (detail !== null) {
      const body = state.details[detail[1] ?? ""];
      return body === undefined ? notFound() : json({ ok: true, data: body });
    }
    return notFound();
  }) as typeof fetch;

  return {
    fetch: fetcher,
    calls,
    state,
    /** Publish a new catalog (a title missing from it is a deleted or disabled one). */
    publish(titles: FakeTitle[]): void {
      state.titles = titles;
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
    catalogCalls: (): FakeCall[] => calls.filter((call) => call.url.includes("/api/titles/catalog")),
    genreCalls: (): FakeCall[] => calls.filter((call) => call.url.includes("/api/titles/genres")),
    /** Every call that was not the catalog walk or the dictionary: live reads (details, seasons, related, channels). */
    otherCalls: (): FakeCall[] =>
      calls.filter((call) => !call.url.includes("/api/titles/catalog") && !call.url.includes("/api/titles/genres")),
  };
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
