import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

import { LOGO_INDEX_MAX_BYTES, LOGO_INDEX_RETRY_MS, LOGO_INDEX_TIMEOUT_MS } from "../constants/limits.js";
import { isAcceptedAddress } from "./address-rule.js";
import type { SafeFetch } from "./safe-fetch.js";

/** CDN failover, StepDaddy's pair (`supplements/logo_resolve.py`). */
const LOGOS_URLS = ["https://iptv-org.github.io/api/logos.json", "https://cdn.jsdelivr.net/gh/iptv-org/api@gh-pages/logos.json"];
const CHANNELS_URLS = ["https://iptv-org.github.io/api/channels.json", "https://cdn.jsdelivr.net/gh/iptv-org/api@gh-pages/channels.json"];

const CACHE_FILE = "logo-index.json";
/** `fetchedAt` is 0 when only a failure stamp is held; `failedAt` is the last failed load, retried after an hour. */
const CacheFile = z.object({
  fetchedAt: z.number(),
  failedAt: z.number().optional(),
  byTvg: z.record(z.string()),
  byName: z.record(z.string()),
});
const LogoRow = z
  .object({
    channel: z.string().optional(),
    url: z.string().optional(),
    width: z.coerce.number().optional(),
    height: z.coerce.number().optional(),
    format: z.string().optional(),
    in_use: z.boolean().optional(),
  })
  .passthrough();
const ChannelRow = z.object({ id: z.string().optional(), name: z.string().optional(), alt_names: z.array(z.string()).default([]) }).passthrough();

const QUALITY = /\([^)]*\)|\b(?:hd|sd|fhd|uhd|4k|720p|1080p|2160p|us|uk|usa|ca|de|fr|it|es)\b/gi;
const NON_ALNUM = /[^a-z0-9]+/g;
const MARKS = /[̀-ͯ]/g;

/** StepDaddy's normalized channel name: accents folded first (`Télé` is `tele`), then case, separators and tags out. */
export function normalizeChannelName(name: string): string {
  return name.normalize("NFD").replace(MARKS, "").toLowerCase().replace(QUALITY, " ").replace(NON_ALNUM, "");
}

/** A logo address must pass the address rule (`03` section 7.3): `http` or `https`, no credentials; `//host` is `https`. */
export function acceptedLogoUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (trimmed === undefined || trimmed === "" || ["null", "none", "undefined", "-"].includes(trimmed.toLowerCase())) {
    return undefined;
  }
  const absolute = trimmed.startsWith("//") ? `https:${trimmed}` : trimmed;
  return isAcceptedAddress(absolute) ? absolute : undefined;
}

const betterScore = (a: [number, number, number], b: [number, number, number]): boolean =>
  a[0] !== b[0] ? a[0] > b[0] : a[1] !== b[1] ? a[1] > b[1] : a[2] > b[2];

/** Indexes both lists; a malformed row is skipped, never thrown on. */
function buildIndex(logos: unknown[] | undefined, channels: unknown[] | undefined) {
  const best = new Map<string, { score: [number, number, number]; url: string }>();
  for (const row of logos ?? []) {
    const parsed = LogoRow.safeParse(row);
    if (!parsed.success) continue;
    const { channel, url: raw, in_use, width, height, format } = parsed.data;
    const url = acceptedLogoUrl(raw);
    if (url === undefined || channel === undefined || channel === "") continue;
    const score: [number, number, number] = [in_use ? 1 : 0, (width ?? 0) * (height ?? 0), format?.toUpperCase() === "PNG" ? 1 : 0];
    const current = best.get(channel);
    if (current === undefined || betterScore(score, current.score)) best.set(channel, { score, url });
  }
  const byTvg = new Map([...best].map(([id, { url }]) => [id, url] as const));
  const byName = new Map<string, string>();
  for (const row of channels ?? []) {
    const parsed = ChannelRow.safeParse(row);
    if (!parsed.success) continue;
    const url = parsed.data.id !== undefined ? byTvg.get(parsed.data.id) : undefined;
    if (url === undefined) continue;
    for (const name of [parsed.data.name, ...parsed.data.alt_names]) {
      const key = normalizeChannelName(name ?? "");
      if (key !== "" && !byName.has(key)) byName.set(key, url);
    }
  }
  return { byTvg, byName };
}

/**
 * The iptv-org logo index (docs/03 section 7.2c, "Enrichment"): `logos.json` grouped by channel id, `channels.json`
 * mapping names and alt_names onto those logos. Loaded once (through the guarded fetch), disk-cached under the data
 * folder with a TTL; a failed load is stamped on disk and not retried for an hour, and degrades to the stale index, then
 * to nothing. `lookup` is synchronous after `load`; a miss is `undefined`.
 */
export function createLogoResolver(deps: { dataDir: string; ttlHours: number; safeFetch: SafeFetch; now: () => number }) {
  const file = path.join(deps.dataDir, CACHE_FILE);
  const ttlMs = deps.ttlHours * 3_600_000;
  let byTvg = new Map<string, string>();
  let byName = new Map<string, string>();
  let fetchedAt = 0;
  let failedAt: number | undefined;
  let loading: Promise<void> | null = null;

  const fresh = (): boolean =>
    (fetchedAt > 0 && deps.now() - fetchedAt < ttlMs) || (failedAt !== undefined && deps.now() - failedAt < LOGO_INDEX_RETRY_MS);

  function adopt(cache: z.infer<typeof CacheFile>): void {
    byTvg = new Map(Object.entries(cache.byTvg));
    byName = new Map(Object.entries(cache.byName));
    fetchedAt = cache.fetchedAt;
    failedAt = cache.failedAt;
  }

  function save(): void {
    try {
      const body = { fetchedAt, failedAt, byTvg: Object.fromEntries(byTvg), byName: Object.fromEntries(byName) };
      writeFileSync(file, JSON.stringify(body), "utf-8");
    } catch {
      // a read-only data folder means no cache, never a failed sync
    }
  }

  /** One CDN pair with failover: the first address that answers a list wins. */
  async function fetchList(urls: readonly string[], signal: AbortSignal): Promise<unknown[] | undefined> {
    for (const url of urls) {
      try {
        const answer = await deps.safeFetch(url, { timeoutMs: LOGO_INDEX_TIMEOUT_MS, maxBytes: LOGO_INDEX_MAX_BYTES, signal });
        if (answer.status < 200 || answer.status >= 300) continue;
        const parsed: unknown = JSON.parse(answer.body.toString("utf-8"));
        if (Array.isArray(parsed)) return parsed;
      } catch {
        if (signal.aborted) return undefined;
      }
    }
    return undefined;
  }

  async function ensure(signal: AbortSignal): Promise<void> {
    if (fresh()) return;
    try {
      adopt(CacheFile.parse(JSON.parse(readFileSync(file, "utf-8"))));
    } catch {
      // no usable cache file
    }
    if (fresh()) return;
    const logos = await fetchList(LOGOS_URLS, signal);
    const channels = await fetchList(CHANNELS_URLS, signal);
    if (signal.aborted) return; // a stop is not a failure: nothing is stamped
    if (logos === undefined && channels === undefined) {
      failedAt = deps.now(); // a stale index beats none; either way this is not retried for an hour
    } else {
      ({ byTvg, byName } = buildIndex(logos, channels));
      fetchedAt = deps.now();
      failedAt = undefined;
    }
    save();
  }

  return {
    /** Loads the index once (a second caller waits for the first); never throws. */
    load(signal: AbortSignal): Promise<void> {
      loading ??= ensure(signal).catch(() => undefined).finally(() => {
        loading = null;
      });
      return loading;
    },

    /** The logo address for an entry without one of its own, or undefined on any miss. */
    lookup(name: string, tvgId?: string | null): string | undefined {
      const tid = tvgId?.split("@")[0]?.trim();
      if (tid !== undefined && tid !== "") {
        const byId = byTvg.get(tid);
        if (byId !== undefined) return byId;
      }
      const key = normalizeChannelName(name);
      return key !== "" ? byName.get(key) : undefined;
    },
  };
}

export type LogoResolver = ReturnType<typeof createLogoResolver>;
