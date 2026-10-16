import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

import { LOGO_INDEX_MAX_BYTES, LOGO_INDEX_TIMEOUT_MS } from "../constants/limits.js";

/** CDN failover, StepDaddy's pair (`supplements/logo_resolve.py`). */
const LOGOS_URLS = ["https://iptv-org.github.io/api/logos.json", "https://cdn.jsdelivr.net/gh/iptv-org/api@gh-pages/logos.json"];
const CHANNELS_URLS = ["https://iptv-org.github.io/api/channels.json", "https://cdn.jsdelivr.net/gh/iptv-org/api@gh-pages/channels.json"];

const CACHE_FILE = "logo-index.json";
const CacheFile = z.object({ fetchedAt: z.number(), byTvg: z.record(z.string()), byName: z.record(z.string()) });
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

/** StepDaddy's normalized channel name: case, separators and quality/region tags out. */
export function normalizeChannelName(name: string): string {
  return name.toLowerCase().replace(QUALITY, " ").replace(NON_ALNUM, "");
}

/** A logo address must be usable `https` (`01` section 7); an `http` logo is upgraded, like StepDaddy's. */
export function httpsLogoUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (trimmed === undefined || trimmed === "" || ["null", "none", "undefined", "-"].includes(trimmed.toLowerCase())) {
    return undefined;
  }
  const upgraded = trimmed.startsWith("//") ? `https:${trimmed}` : trimmed.startsWith("http://") ? `https://${trimmed.slice(7)}` : trimmed;
  return upgraded.startsWith("https://") ? upgraded : undefined;
}

/**
 * The iptv-org logo index (docs/03 section 7.2c, "Enrichment"): `logos.json` grouped by channel id,
 * `channels.json` mapping names and alt_names onto those logos. Disk-cached under the data folder with
 * a TTL; a fetch failure degrades to the stale cache, then to nothing. A miss returns `undefined`.
 */
export function createLogoResolver(deps: { dataDir: string; ttlHours: number; fetchImpl?: typeof fetch; now: () => number }) {
  const file = path.join(deps.dataDir, CACHE_FILE);
  const ttlMs = deps.ttlHours * 3_600_000;
  const fetchImpl = deps.fetchImpl ?? fetch;
  let byTvg = new Map<string, string>();
  let byName = new Map<string, string>();
  let loadedAt: number | null = null;
  let loading: Promise<void> | null = null;

  function readCache(): z.infer<typeof CacheFile> | null {
    try {
      return CacheFile.parse(JSON.parse(readFileSync(file, "utf-8")));
    } catch {
      return null;
    }
  }

  function adopt(cache: z.infer<typeof CacheFile>): void {
    byTvg = new Map(Object.entries(cache.byTvg));
    byName = new Map(Object.entries(cache.byName));
    loadedAt = cache.fetchedAt;
  }

  function saveCache(): void {
    try {
      writeFileSync(
        file,
        JSON.stringify({ fetchedAt: loadedAt, byTvg: Object.fromEntries(byTvg), byName: Object.fromEntries(byName) }),
        "utf-8",
      );
    } catch {
      // a read-only data folder means no cache, never a failed sync
    }
  }

  /** One CDN pair with failover: the first address that answers a list wins. */
  async function fetchList(urls: readonly string[]): Promise<unknown[] | undefined> {
    for (const url of urls) {
      try {
        const response = await fetchImpl(url, { signal: AbortSignal.timeout(LOGO_INDEX_TIMEOUT_MS) });
        if (!response.ok) continue;
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.byteLength > LOGO_INDEX_MAX_BYTES) continue;
        const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // try the next CDN
      }
    }
    return undefined;
  }

  function build(logos: unknown[] | undefined, channels: unknown[] | undefined): void {
    const better = (a: [number, number, number], b: [number, number, number]): boolean =>
      a[0] !== b[0] ? a[0] > b[0] : a[1] !== b[1] ? a[1] > b[1] : a[2] > b[2];
    const best = new Map<string, { score: [number, number, number]; url: string }>();
    for (const row of logos ?? []) {
      const parsed = LogoRow.parse(row);
      const url = httpsLogoUrl(parsed.url);
      if (url === undefined || parsed.channel === undefined || parsed.channel === "") continue;
      const score: [number, number, number] = [
        parsed.in_use ? 1 : 0,
        (parsed.width ?? 0) * (parsed.height ?? 0),
        parsed.format?.toUpperCase() === "PNG" ? 1 : 0,
      ];
      const current = best.get(parsed.channel);
      if (current === undefined || better(score, current.score)) best.set(parsed.channel, { score, url });
    }
    byTvg = new Map([...best].map(([id, { url }]) => [id, url]));
    byName = new Map();
    for (const row of channels ?? []) {
      const parsed = ChannelRow.parse(row);
      const url = parsed.id !== undefined ? byTvg.get(parsed.id) : undefined;
      if (url === undefined) continue;
      for (const name of [parsed.name, ...parsed.alt_names]) {
        const key = normalizeChannelName(name ?? "");
        if (key !== "" && !byName.has(key)) byName.set(key, url);
      }
    }
    loadedAt = deps.now();
  }

  async function ensure(): Promise<void> {
    if (loadedAt !== null && deps.now() - loadedAt < ttlMs) return;
    if (loading !== null) return loading;
    loading = (async () => {
      const cache = readCache();
      if (cache !== null && deps.now() - cache.fetchedAt < ttlMs) {
        adopt(cache);
        return;
      }
      const logos = await fetchList(LOGOS_URLS);
      const channels = await fetchList(CHANNELS_URLS);
      if (logos === undefined && channels === undefined) {
        if (cache !== null) adopt(cache); // a stale index beats none
        loadedAt = deps.now(); // either way, this attempt is not retried once per entry
        return;
      }
      build(logos, channels);
      saveCache();
    })().finally(() => {
      loading = null;
    });
    return loading;
  }

  return {
    /** The logo address for an entry without one of its own, or undefined on any miss. */
    async resolve(name: string, tvgId?: string): Promise<string | undefined> {
      try {
        await ensure();
      } catch {
        return undefined; // an unreachable index is a missing enrichment, never a failed sync
      }
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
