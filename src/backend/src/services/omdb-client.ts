import { OMDB_DEFAULT_DAILY_LIMIT, OMDB_HEADROOM, OMDB_TIMEOUT_MS } from "../constants/limits.js";

const utcDay = (now: number): string => new Date(now).toISOString().slice(0, 10);

/**
 * What one OMDb lookup came to: the record, a miss (OMDb does not know the id), no budget left (unconfigured, the daily
 * limit, or `Request limit reached.`), or an outage (the call did not complete; also a Stop in flight).
 */
export type OmdbAnswer =
  | { status: "found"; record: Record<string, unknown> }
  | { status: "miss" | "over" | "error" };

/**
 * The OMDb client (docs/11 section 7): detail enrichment by IMDb id, one call per title, inside the owner's daily
 * budget. OMDb answers `200` for everything - `{Response: "True", ...}` or `{Response: "False", Error: "..."}` - so the
 * status code is never read. Only the Library fill's details phase asks (docs/11 section 7.3); a public read never does.
 */
export function createOmdbClient(options: { key: string; base?: string; dailyLimit?: number; now?: () => number }) {
  const { key } = options;
  const base = options.base ?? "https://www.omdbapi.com/";
  const limit = options.dailyLimit ?? OMDB_DEFAULT_DAILY_LIMIT;
  const now = options.now ?? Date.now;
  let day = utcDay(now());
  let calls = 0;
  let stopped = false;

  const roll = (): void => {
    const today = utcDay(now());
    if (today !== day) {
      day = today;
      calls = 0;
      stopped = false;
    }
  };
  const available = (): boolean => {
    if (key === "") return false;
    roll();
    return !stopped && calls < Math.max(1, limit - OMDB_HEADROOM);
  };

  return {
    configured: key !== "",
    /** Whether a call may be made now: a key, today's budget not spent, and no `Request limit reached.` today. */
    available,
    /** The OMDb record for an IMDb id. `signal` ends the call early (a Stop); it then answers `error`. */
    async lookup(imdbId: string, signal?: AbortSignal): Promise<OmdbAnswer> {
      if (!available()) return { status: "over" };
      calls += 1;
      const timeout = AbortSignal.timeout(OMDB_TIMEOUT_MS);
      let answer: unknown;
      try {
        const response = await fetch(`${base}?i=${encodeURIComponent(imdbId)}&plot=full&apikey=${key}`, {
          signal: signal ? AbortSignal.any([timeout, signal]) : timeout,
        });
        answer = await response.json();
      } catch {
        return { status: "error" }; // an outage is a missing enrichment, never a failed title
      }
      const record = (typeof answer === "object" && answer !== null ? answer : {}) as Record<string, unknown>;
      if (record.Response === "True") return { status: "found", record };
      // A refused key or the day's limit is no title's fault: nothing more is asked today.
      if (record.Error === "Request limit reached." || /API key/.test(String(record.Error))) {
        stopped = true;
        return { status: "over" };
      }
      return { status: "miss" };
    },
    /** For the sync status endpoint (docs/11 section 7.3: the quota is a budget). */
    quota(): { enabled: boolean; calls: number; limit: number } {
      roll();
      return { enabled: key !== "", calls: key !== "" ? calls : 0, limit };
    },
  };
}

export type OmdbClient = ReturnType<typeof createOmdbClient>;
