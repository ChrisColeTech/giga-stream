import { AppError, ERRORS } from "../constants/errors.js";
import {
  TMDB_BACKOFF_MS, TMDB_MIN_GAP_MS, TMDB_MIN_REQUESTS_PER_SECOND, TMDB_REQUESTS_PER_SECOND, TMDB_RETRIES, TMDB_TIMEOUT_MS,
} from "../constants/limits.js";

type Params = Record<string, string | number | undefined>;

/** The error a call ends with when its caller's signal aborted; the caller already knows why. */
const aborted = (): DOMException => new DOMException("The request was stopped.", "AbortError");

/** Waits `ms`, or less: it ends the moment `signal` aborts (the caller checks the signal). */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const done = (): void => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal?.addEventListener("abort", done, { once: true });
  });
}

/** `call`, or an `AbortError` the moment `signal` aborts (the call itself checks the signal and ends soon after). */
function untilAborted<T>(call: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(aborted());
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => reject(aborted());
    signal.addEventListener("abort", onAbort, { once: true });
    call.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}

/**
 * The TMDB client (docs/03 section 7.6): read token in the `Authorization` header, at most `TMDB_REQUESTS_PER_SECOND`
 * requests a second (halved by each 429 until `resetPace`, floor 2 a second), backing off on `429` and `5xx`, and merging identical in-flight requests. Every call answers parsed JSON or
 * `503 tmdb.unavailable`. A caller that passes a `signal` (docs/44 section 3.2) can stop its call at any moment - during
 * the pacing wait, the request or a backoff sleep - and is never retried after; it does not join or share a merged
 * request, so its abort cannot cancel another caller's.
 */
export function createTmdbClient(options: { token: string; base?: string; now?: () => number; minGapMs?: number; backoffMs?: number }) {
  const base = (options.base ?? "https://api.themoviedb.org/3").replace(/\/+$/, "");
  const now = options.now ?? Date.now;
  const minGapMs = options.minGapMs ?? TMDB_MIN_GAP_MS;
  const backoffMs = options.backoffMs ?? TMDB_BACKOFF_MS;
  let lastStart = 0;
  /** How many times slower than the full pace the client now goes: 1, doubled by each 429, at most 10 (2 a second). */
  let slow = 1;
  let chained: Promise<void> = Promise.resolve();
  const inflight = new Map<string, Promise<unknown>>();

  /** `new URL(path, base)` would drop the base's `/3` path segment, so the address is joined by hand. */
  const addressOf = (path: string, params: Params): string => {
    const url = new URL(`${base}${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    return url.href;
  };

  async function raw(path: string, params: Params, signal?: AbortSignal): Promise<unknown> {
    const url = new URL(addressOf(path, params));
    const timeout = (): AbortSignal => (signal ? AbortSignal.any([AbortSignal.timeout(TMDB_TIMEOUT_MS), signal]) : AbortSignal.timeout(TMDB_TIMEOUT_MS));
    for (let attempt = 0; ; attempt++) {
      if (signal?.aborted) throw aborted();
      // Pace every call behind the last one, about five a second.
      const gap = lastStart + minGapMs * slow - now();
      if (gap > 0) await sleep(gap, signal);
      if (signal?.aborted) throw aborted();
      lastStart = now();
      let response: Response;
      try {
        response = await fetch(url, {
          headers: { accept: "application/json", authorization: `Bearer ${options.token}` },
          signal: timeout(),
        });
      } catch {
        if (signal?.aborted) throw aborted();
        if (attempt < 1) continue;
        throw new AppError(ERRORS.tmdbUnavailable, { reason: "unreachable" });
      }
      // A 429 halves the pace for the rest of the run (`resetPace` starts the next run at full speed).
      if (response.status === 429) slow = Math.min(slow * 2, TMDB_REQUESTS_PER_SECOND / TMDB_MIN_REQUESTS_PER_SECOND);
      if ((response.status === 429 || response.status >= 500) && attempt < TMDB_RETRIES) {
        await sleep(backoffMs * (attempt + 1), signal);
        continue;
      }
      if (!response.ok) {
        throw new AppError(ERRORS.tmdbUnavailable, { status: response.status });
      }
      try {
        return (await response.json()) as unknown;
      } catch (error) {
        if (signal?.aborted) throw aborted();
        throw error;
      }
    }
  }

  /** Queues `work` behind the calls already waiting, so the pacing holds across callers. */
  function queued(work: () => Promise<unknown>): Promise<unknown> {
    const call = chained.catch(() => {}).then(work);
    chained = call.then(
      () => undefined,
      () => undefined,
    );
    return call;
  }

  return {
    configured: options.token !== "",
    /** GET `path`; callers without a `signal` share one request for the same address. */
    get<T>(path: string, params: Params = {}, callOptions: { signal?: AbortSignal } = {}): Promise<T> {
      const { signal } = callOptions;
      if (signal !== undefined) {
        const own = queued(() => (signal.aborted ? Promise.reject(aborted()) : raw(path, params, signal)));
        return untilAborted(own, signal) as Promise<T>;
      }
      const key = addressOf(path, params);
      const running = inflight.get(key);
      if (running) return running as Promise<T>;
      const call = queued(() => raw(path, params)).finally(() => inflight.delete(key));
      inflight.set(key, call);
      return call as Promise<T>;
    },
    /** The pause between two requests now (the full pace's, lengthened by any 429 this run). */
    paceMs: (): number => minGapMs * slow,
    /** A new run starts at the full pace again. */
    resetPace(): void {
      slow = 1;
    },
    /** Count of identical requests currently being merged. Exposed for tests. */
    merging(): number {
      return inflight.size;
    },
  };
}

export type TmdbClient = ReturnType<typeof createTmdbClient>;
