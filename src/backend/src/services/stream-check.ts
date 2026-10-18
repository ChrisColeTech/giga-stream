import { HEALTH_BATCH, PROBE_BUDGET_MS, STREAM_CHECK_PREFIX_BYTES, STREAM_CHECK_TIMEOUT_MS } from "../constants/limits.js";
import type { Verdict } from "../store/channel-health.js";
import type { Store } from "../store/store.js";
import type { SyncRun } from "../types/sync-run.js";
import type { RequestLimiter } from "./request-limiter.js";
import type { SafeFetch } from "./safe-fetch.js";

const MANIFEST = "#EXTM3U";

/** Live iff the body, after a BOM and whitespace, starts `#EXTM3U` (docs/43 section 3.4 step 5). */
export const isManifest = (body: Buffer): boolean => new TextDecoder().decode(body).trimStart().startsWith(MANIFEST);

/**
 * Step 5: each of the playlist's distinct stream addresses is requested through the guarded fetch, on the sync's shared
 * limiter, and judged by that address alone: a 2xx answer whose body is an HLS manifest is `live`; anything else,
 * including a DNS, refused or timed-out request, is `dead` for the channels with that address only. There is no host
 * check and no host shortcut. Verdicts are written per address in batches (no revision); the probe budget ends the
 * check and the rest stay unchecked, first in line next run. A request aborted by a stop records nothing.
 */
export function createStreamCheck(deps: { store: Store; safeFetch: SafeFetch; limiter: RequestLimiter; now: () => number }) {
  const { store, safeFetch, limiter, now } = deps;

  async function probe(url: string, signal: AbortSignal): Promise<"live" | "dead" | undefined> {
    try {
      const answer = await safeFetch(url, { timeoutMs: STREAM_CHECK_TIMEOUT_MS, prefixBytes: STREAM_CHECK_PREFIX_BYTES, signal });
      return answer.status >= 200 && answer.status < 300 && isManifest(answer.body) ? "live" : "dead";
    } catch {
      return signal.aborted ? undefined : "dead";
    }
  }

  return async function checkStreams(run: SyncRun): Promise<void> {
    const stopAt = Math.min(run.endsAt, now() + PROBE_BUDGET_MS);
    const urls = store.health.streamUrls(run.playlistId);
    let pending: Verdict[] = [];
    const flush = (): void => {
      if (pending.length === 0) return;
      const batch = pending;
      pending = [];
      store.health.writeVerdicts(run.playlistId, batch);
    };
    const one = (url: string): Promise<void> =>
      limiter.run(URL.canParse(url) ? new URL(url).host : "", async () => {
        if (run.signal.aborted || now() >= stopAt) return;
        const status = await probe(url, run.signal);
        if (status === undefined) return;
        pending.push({ url, status, at: now() });
        if (pending.length >= HEALTH_BATCH) flush();
      });
    try {
      await Promise.all(urls.map((url) => one(url).catch(() => undefined)));
    } finally {
      flush();
    }
  };
}

export type StreamCheck = ReturnType<typeof createStreamCheck>;
