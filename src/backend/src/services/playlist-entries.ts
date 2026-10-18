import {
  ADDRESS_MAX,
  CHANNEL_CATEGORY_MAX,
  CHANNEL_NAME_MAX,
  PLAYLIST_SYNC_EXAMPLES_MAX,
} from "../constants/limits.js";
import { isAcceptedAddress } from "./address-rule.js";
import { m3uKeyOf, parseM3U, type M3uEntry } from "./m3u-parser.js";

export interface ScreenedPlaylist {
  entries: M3uEntry[];
  /** Entries left out for their shape: no name, too long, a repeat, or past the cap. */
  skipped: number;
  /** Entries whose stream or logo address failed the address rule (docs/03 section 7.3). */
  refused: number;
  /** The names of some refused entries - never an address, which can be a credential. */
  refusalExamples: string[];
}

const tooLong = (value: string | undefined): boolean => value !== undefined && value.length > ADDRESS_MAX;

/**
 * Parses a playlist body and screens its entries (docs/43 section 3.2): a stream or logo address that fails the
 * address rule or `ADDRESS_MAX` is refused and counted, never imported broken; an entry with an unusable name or
 * category, a repeat of the same name and stream address, or one past `maxEntries` is skipped and counted. A body
 * that is not an M3U playlist is `422 playlist.invalid` (raised by the parser).
 */
export function screenPlaylist(text: string, options: { maxEntries: number }): ScreenedPlaylist {
  const { maxEntries } = options;
  const seen = new Set<string>();
  const entries: M3uEntry[] = [];
  const refusalExamples: string[] = [];
  let skipped = 0;
  let refused = 0;
  for (const entry of parseM3U(text)) {
    const bad =
      tooLong(entry.streamUrl) || tooLong(entry.logoUrl) || !isAcceptedAddress(entry.streamUrl) ||
      (entry.logoUrl !== undefined && !isAcceptedAddress(entry.logoUrl));
    if (bad) {
      refused += 1;
      if (refusalExamples.length < PLAYLIST_SYNC_EXAMPLES_MAX) refusalExamples.push(entry.name.slice(0, CHANNEL_NAME_MAX));
      continue;
    }
    const unusable =
      entry.name === "" || entry.name.length > CHANNEL_NAME_MAX ||
      (entry.groupTitle !== undefined && entry.groupTitle.length > CHANNEL_CATEGORY_MAX);
    if (unusable || seen.has(m3uKeyOf(entry)) || entries.length >= maxEntries) {
      skipped += 1;
      continue;
    }
    seen.add(m3uKeyOf(entry));
    entries.push(entry);
  }
  return { entries, skipped, refused, refusalExamples };
}
