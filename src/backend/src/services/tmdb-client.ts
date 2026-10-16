import { AppError, ERRORS } from "../constants/errors.js";

/**
 * The TMDB client (docs/03 section 7.6): read token in the `Authorization` header, at most about five
 * requests a second, backing off on `429`, and merging identical in-flight requests. Every call
 * answers parsed JSON or `503 tmdb.unavailable`.
 */
export function createTmdbClient(options: { token: string; base?: string; now?: () => number }) {
  const base = (options.base ?? "https://api.themoviedb.org/3").replace(/\/+$/, "");
  const now = options.now ?? Date.now;
  const MIN_GAP_MS = 210; // ~4.8 requests a second
  const BACKOFF_MS = 2_500;
  let lastStart = 0;
  let chained: Promise<void> = Promise.resolve();
  const inflight = new Map<string, Promise<unknown>>();

  /** `new URL(path, base)` would drop the base's `/3` path segment, so the address is joined by hand. */
  const addressOf = (path: string, params: Record<string, string | number | undefined>): string => {
    const url = new URL(`${base}${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    return url.href;
  };

  async function raw(path: string, params: Record<string, string | number | undefined>): Promise<unknown> {
    const url = new URL(addressOf(path, params));
    for (let attempt = 0; ; attempt++) {
      // Pace every call behind the last one, about five a second.
      const gap = lastStart + MIN_GAP_MS - now();
      if (gap > 0) await new Promise((resolve) => setTimeout(resolve, gap));
      lastStart = now();
      let response: Response;
      try {
        response = await fetch(url, {
          headers: { accept: "application/json", authorization: `Bearer ${options.token}` },
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        if (attempt < 1) continue;
        throw new AppError(ERRORS.tmdbUnavailable, { reason: "unreachable" });
      }
      if (response.status === 429 && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, BACKOFF_MS * (attempt + 1)));
        continue;
      }
      if (!response.ok) {
        throw new AppError(ERRORS.tmdbUnavailable, { status: response.status });
      }
      return (await response.json()) as unknown;
    }
  }

  return {
    configured: options.token !== "",
    /** GET `path` with merged in-flight calls for the same address. */
    get<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
      const key = addressOf(path, params);
      const running = inflight.get(key);
      if (running) return running as Promise<T>;
      const call = chained
        .catch(() => {})
        .then(() => raw(path, params))
        .finally(() => {
          inflight.delete(key);
          void 0;
        });
      inflight.set(key, call);
      chained = call.then(
        () => undefined,
        () => undefined,
      );
      return call as Promise<T>;
    },
    /** Count of identical requests currently being merged. Exposed for tests. */
    merging(): number {
      return inflight.size;
    },
  };
}

export type TmdbClient = ReturnType<typeof createTmdbClient>;
