import { AppError, ERRORS } from "../constants/errors.js";
import {
  ADDRESS_MAX,
  CHANNEL_CATEGORY_MAX,
  CHANNEL_NAME_MAX,
  PLAYLIST_FETCH_TIMEOUT_MS,
  PLAYLIST_SYNC_EXAMPLES_MAX,
} from "../constants/limits.js";
import { isAcceptedAddress } from "./address-rule.js";
import { m3uKeyOf, parseM3U, type M3uEntry } from "./m3u-parser.js";

export interface FetchedPlaylist {
  host: string;
  entries: M3uEntry[];
  skipped: number;
  refused: number;
  refusalExamples: string[];
}

/**
 * One configured playlist (docs/03 section 7.2c, "The run"): fetched once with a timeout and the
 * `PLAYLIST_SYNC_MAX_BYTES` cap, parsed, deduped by name and stream address, capped at
 * `PLAYLIST_SYNC_MAX` entries, and every entry run through the address rule — an `http` address is
 * skipped and counted, never imported broken.
 */
export async function fetchPlaylist(options: {
  url: string;
  maxBytes: number;
  maxEntries: number;
  allowLoopback: boolean;
  fetchImpl: typeof fetch;
}): Promise<FetchedPlaylist> {
  const { url, maxBytes, maxEntries, allowLoopback, fetchImpl } = options;
  const host = new URL(url).host;
  let response: Response;
  try {
    response = await fetchImpl(url, { signal: AbortSignal.timeout(PLAYLIST_FETCH_TIMEOUT_MS) });
  } catch {
    throw new AppError(ERRORS.playlistUnreachable, { host });
  }
  if (!response.ok) throw new AppError(ERRORS.playlistUnreachable, { host, status: response.status });
  const bytes = new Uint8Array(await response.arrayBuffer()).subarray(0, maxBytes);
  const seen = new Set<string>();
  const entries: M3uEntry[] = [];
  const refusalExamples: string[] = [];
  let skipped = 0;
  let refused = 0;
  for (const entry of parseM3U(new TextDecoder().decode(bytes))) {
    if (!isAcceptedAddress(entry.streamUrl, allowLoopback)) {
      refused += 1;
      if (refusalExamples.length < PLAYLIST_SYNC_EXAMPLES_MAX) refusalExamples.push(`${entry.name} (${entry.streamUrl})`);
      continue;
    }
    const unusable =
      entry.name === "" || entry.name.length > CHANNEL_NAME_MAX || entry.streamUrl.length > ADDRESS_MAX ||
      (entry.groupTitle !== undefined && entry.groupTitle.length > CHANNEL_CATEGORY_MAX);
    if (unusable || seen.has(m3uKeyOf(entry)) || entries.length >= maxEntries) {
      skipped += 1;
      continue;
    }
    seen.add(m3uKeyOf(entry));
    entries.push(entry);
  }
  return { host, entries, skipped, refused, refusalExamples };
}
