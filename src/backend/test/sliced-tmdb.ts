// A fake TMDB discover for the sliced walk (docs/48): a ground truth of dated titles per kind, served as TMDB serves it -
// 20 rows a page, a 400 past page 500, `total_results` capped at 20,001, inclusive date bounds, the year filters, and
// titles with no date left out of any dated query. Used as the walk's client directly, so nothing listens on a port.
import { datedIn, type DiscoverKind } from "./discover-dates.js";

export interface FakeTitle {
  id: number;
  /** `YYYY-MM-DD`, or empty for a title with no date. */
  date: string;
}

type Params = Record<string, string | number | undefined>;

/** `count` titles from `firstId` up, each dated by `dateOf(index)`. */
export const titlesOf = (firstId: number, count: number, dateOf: (index: number) => string): FakeTitle[] =>
  Array.from({ length: count }, (_, index) => ({ id: firstId + index, date: dateOf(index) }));

/** The day `index` days after 1 January of `year`. */
export const dayOfYear = (year: number, index: number): string =>
  new Date(Date.UTC(year, 0, 1 + index)).toISOString().slice(0, 10);

export function fakeDiscover(data: Record<DiscoverKind, FakeTitle[]>) {
  const requests: Array<{ kind: DiscoverKind; page: number; params: Params }> = [];
  const violations: string[] = [];
  let before: (count: number) => void = () => undefined;

  async function get<T>(path: string, params: Params = {}, options: { signal?: AbortSignal } = {}): Promise<T> {
    const kind: DiscoverKind = path === "/discover/tv" ? "tv" : "movie";
    const page = Number(params.page);
    requests.push({ kind, page, params });
    before(requests.length);
    if (options.signal?.aborted) throw new DOMException("The request was stopped.", "AbortError");
    if (page > 500) {
      violations.push(`${kind} page ${page}`);
      throw new Error("400 Invalid page: Pages start at 1 and max at 500");
    }
    const url = new URL("http://fake.test/");
    for (const [key, value] of Object.entries(params)) if (value !== undefined) url.searchParams.set(key, String(value));
    const matching = data[kind].filter((title) => title.date !== "" && datedIn(url, kind, title.date));
    const rows = matching.slice((page - 1) * 20, page * 20).map((title) => ({
      id: title.id, [kind === "movie" ? "title" : "name"]: `${kind} ${title.id}`,
      [kind === "movie" ? "release_date" : "first_air_date"]: title.date, popularity: 10, vote_average: 6, genre_ids: [],
    }));
    const answer: unknown = {
      page, results: rows, total_results: Math.min(matching.length, 20_001),
      total_pages: Math.ceil(Math.min(matching.length, 20_001) / 20),
    };
    return answer as T;
  }

  return {
    client: { get },
    requests,
    violations,
    /** Runs before each request is answered, with the count of requests so far. */
    onRequest: (hook: (count: number) => void): void => void (before = hook),
  };
}

export type FakeDiscover = ReturnType<typeof fakeDiscover>;
