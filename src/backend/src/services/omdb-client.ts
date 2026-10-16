/** Stop enriching a little before the daily quota so an ordinary read never sees the refusal. */
const HEADROOM = 10;

const utcDay = (now: number): string => new Date(now).toISOString().slice(0, 10);

/**
 * The OMDb client (docs/11 section 7): detail enrichment by IMDb id, one call per opened title, inside
 * the owner's daily budget. OMDb answers `200` for everything — `{Response: "True", ...}` or
 * `{Response: "False", Error: "..."}` — so the status code is never read. A miss or an exhausted
 * budget returns `undefined`: the title is served TMDB-shaped, never failed (docs/11 section 7.3).
 */
export function createOmdbClient(options: { key: string; base?: string; dailyLimit?: number; now?: () => number }) {
  const { key } = options;
  const base = options.base ?? "https://www.omdbapi.com/";
  const limit = options.dailyLimit ?? 1_000;
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

  return {
    configured: key !== "",
    /** The OMDb record for an IMDb id, or undefined when unconfigured, over budget, or a miss. */
    async get(imdbId: string): Promise<Record<string, unknown> | undefined> {
      if (key === "") return undefined;
      roll();
      if (stopped || calls >= Math.max(1, limit - HEADROOM)) return undefined;
      calls += 1;
      let response: Response;
      try {
        response = await fetch(`${base}?i=${encodeURIComponent(imdbId)}&plot=full&apikey=${key}`, {
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        return undefined; // an outage is a missing enrichment, never a failed title
      }
      let answer: unknown;
      try {
        answer = await response.json();
      } catch {
        return undefined;
      }
      const record = (typeof answer === "object" && answer !== null ? answer : {}) as Record<string, unknown>;
      if (record.Response === "True") return record;
      if (record.Error === "Request limit reached.") stopped = true;
      return undefined;
    },
    /** For the sync status endpoint (docs/11 section 7.3: the quota is a budget). */
    quota(): { enabled: boolean; calls: number; limit: number } {
      roll();
      return { enabled: key !== "", calls: key !== "" ? calls : 0, limit };
    },
  };
}

export type OmdbClient = ReturnType<typeof createOmdbClient>;
