import { CHANNEL_NUMBER_MAX, M3U_DETECT_LINES, TVG_ID_MAX } from "../constants/limits.js";
import { AppError, ERRORS } from "../constants/errors.js";

/** One `#EXTINF` entry, parsed the way StepDaddy's `supplements/m3u_parse.py` does (docs/20 section 9.1). */
export interface M3uEntry {
  name: string;
  tvgId?: string;
  logoUrl?: string;
  groupTitle?: string;
  number?: string; // the `tvg-chno` attribute, the M3U convention for a channel number
  streamUrl: string;
}

const ATTRIBUTE = /([A-Za-z0-9-]+)="([^"]*)"/g;
const BYTE_ORDER_MARK = /^﻿/;

function attributesOf(line: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of line.matchAll(ATTRIBUTE)) attrs[match[1]!.toLowerCase()] = match[2] ?? "";
  return attrs;
}

/**
 * M3U detection (docs/43 section 3.2): `#EXTM3U` as the first non-empty line (after a byte-order mark), or an
 * `#EXTINF` within the first `M3U_DETECT_LINES` lines. An HTML page that merely mentions the word fails.
 */
export function looksLikeM3U(text: string): boolean {
  const lines = text.replace(BYTE_ORDER_MARK, "").split(/\r?\n/);
  const first = lines.find((line) => line.trim() !== "");
  if (first !== undefined && first.trim().toUpperCase().startsWith("#EXTM3U")) return true;
  return lines.slice(0, M3U_DETECT_LINES).some((line) => line.trim().startsWith("#EXTINF"));
}

/**
 * The M3U parser (docs/03 section 7.2c): each `#EXTINF` line carries the attributes and the name after
 * its last comma, and the next non-comment line is the stream address. A body that is not an M3U
 * playlist is `422 playlist.invalid`. Names are NFC-normalised here, once.
 */
export function parseM3U(text: string): M3uEntry[] {
  if (!looksLikeM3U(text)) throw new AppError(ERRORS.playlistInvalid, {});
  const entries: M3uEntry[] = [];
  let pending: Record<string, string> | null = null;
  let pendingName = "";
  for (const raw of text.replace(BYTE_ORDER_MARK, "").split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "") continue;
    if (line.startsWith("#EXTINF:")) {
      pending = attributesOf(line);
      const comma = line.lastIndexOf(",");
      pendingName = comma >= 0 ? line.slice(comma + 1).trim() : (pending["tvg-name"] ?? "").trim();
      continue;
    }
    if (line.startsWith("#") || pending === null) continue;
    const tvgId = pending["tvg-id"]?.trim();
    const logo = pending["tvg-logo"]?.trim();
    const group = pending["group-title"]?.trim();
    const number = pending["tvg-chno"]?.trim();
    entries.push({
      name: (pendingName || (pending["tvg-name"] ?? "").trim() || "Channel").normalize("NFC"),
      streamUrl: line,
      ...(tvgId !== undefined && tvgId !== "" && tvgId.length <= TVG_ID_MAX && { tvgId }),
      ...(logo !== undefined && logo !== "" && { logoUrl: logo }),
      ...(group !== undefined && group !== "" && { groupTitle: group }),
      ...(number !== undefined && number !== "" && number.length <= CHANNEL_NUMBER_MAX && { number }),
    });
    pending = null;
  }
  return entries;
}

/** StepDaddy's dedupe key (`supplements/open_iptv.py`): the same name and stream address are one entry. */
export const m3uKeyOf = (entry: M3uEntry): string => `${entry.name}|${entry.streamUrl}`;
