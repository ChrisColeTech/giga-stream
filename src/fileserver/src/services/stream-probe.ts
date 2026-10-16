import type { ChannelStatus } from "../types/channel.js";

/** The one probe of the fileserver (`14` section 4a, `02` §3.7). It knows nothing about providers. */
export const PROBE_TIMEOUT_MS = 4_000;
export const PROBE_MAX_BYTES = 64 * 1024;
export const PROBE_CONCURRENCY = 6;
const MANIFEST_MAGIC = "#EXTM3U";

export interface StreamProbe {
  /** `live` or `offline`; an address that is not `http(s)` is never probed and stays `unknown`. */
  check(url: string, signal?: AbortSignal): Promise<ChannelStatus>;
  /** Probe each distinct address, at most `PROBE_CONCURRENCY` at once; stops early when `signal` aborts. */
  checkAll(urls: readonly string[], signal?: AbortSignal): Promise<Map<string, ChannelStatus>>;
}

function isProbeable(url: string): boolean {
  try {
    const protocol = new URL(url).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/** The first `limit` bytes of the body as text; the rest is cancelled unread. */
async function readPrefix(response: Response, limit: number): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < limit) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
  }
  await reader.cancel();
  return Buffer.concat(chunks).subarray(0, limit).toString("utf-8");
}

export function createStreamProbe(options: { fetch?: typeof fetch; timeoutMs?: number } = {}): StreamProbe {
  const doFetch = options.fetch ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? PROBE_TIMEOUT_MS;

  async function check(url: string, signal?: AbortSignal): Promise<ChannelStatus> {
    if (!isProbeable(url)) return "unknown";
    const timeout = AbortSignal.timeout(timeoutMs);
    const bound = signal ? AbortSignal.any([signal, timeout]) : timeout;
    try {
      const response = await doFetch(url, {
        method: "GET",
        redirect: "follow",
        credentials: "omit",
        signal: bound,
      });
      if (response.status < 200 || response.status > 299) {
        await response.body?.cancel();
        return "offline";
      }
      return (await readPrefix(response, PROBE_MAX_BYTES)).startsWith(MANIFEST_MAGIC) ? "live" : "offline";
    } catch {
      return "offline";
    }
  }

  async function checkAll(urls: readonly string[], signal?: AbortSignal): Promise<Map<string, ChannelStatus>> {
    const queue = [...new Set(urls)];
    const results = new Map<string, ChannelStatus>();
    async function worker(): Promise<void> {
      for (;;) {
        const url = queue.shift();
        if (url === undefined || signal?.aborted) return;
        results.set(url, await check(url, signal));
      }
    }
    await Promise.all(Array.from({ length: Math.min(PROBE_CONCURRENCY, queue.length) }, worker));
    return results;
  }

  return { check, checkAll };
}
