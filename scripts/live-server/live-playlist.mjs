import { rewriteMasterUris } from "./playlist-parse.mjs";

export const DEFAULT_SEGMENT_MS = 2000;
export const DEFAULT_WINDOW = 6;

/**
 * The sliding window at a wall-clock moment. Segment k is complete once (k+1) segment lengths have
 * elapsed, so the newest complete segment is floor(elapsed / length) - 1 and the window holds the
 * `windowSize` segments up to it. The media sequence advances by one every segment length.
 */
export function windowAt({ elapsedMs, segmentMs = DEFAULT_SEGMENT_MS, windowSize = DEFAULT_WINDOW }) {
  const completed = Math.max(0, Math.floor(elapsedMs / segmentMs));
  return { first: Math.max(0, completed - windowSize), last: completed - 1 };
}

/** The virtual segment file name: number padded to five digits, with the source extension. */
export function virtualSegmentName(number, extension) {
  return `seg${String(number).padStart(5, "0")}.${extension}`;
}

/** Parses a virtual segment name back to { number, extension }, or null when it is not one. */
export function parseVirtualSegment(name) {
  const match = /^seg(\d{5,})\.([a-z0-9]+)$/.exec(name);
  return match ? { number: Number(match[1]), extension: match[2] } : null;
}

function extensionOf(uri) {
  return uri.split(".").at(-1) ?? "ts";
}

/** Which source segment a virtual number plays, and how many loop wraps happened before it. */
export function sourceIndexOf(number, count) {
  return { index: number % count, cycle: Math.floor(number / count) };
}

/**
 * A live media playlist computed from the wall clock over a looping source.
 * `segments` is the source's [{ uri, duration }]; `epochMs` is the wall time of virtual segment 0.
 * Program date-time advances by one segment length per number. A loop wrap carries
 * EXT-X-DISCONTINUITY and the playlist counts the wraps that left the window. Never ends.
 */
export function renderMediaPlaylist({
  segments,
  elapsedMs,
  epochMs,
  segmentMs = DEFAULT_SEGMENT_MS,
  windowSize = DEFAULT_WINDOW,
}) {
  const count = segments.length;
  const { first, last } = windowAt({ elapsedMs, segmentMs, windowSize });
  const target = Math.ceil(Math.max(...segments.map((segment) => segment.duration)));
  const removedWraps = first >= 1 ? Math.floor((first - 1) / count) : 0;
  const lines = ["#EXTM3U", "#EXT-X-VERSION:3", `#EXT-X-TARGETDURATION:${target}`, `#EXT-X-MEDIA-SEQUENCE:${first}`];
  if (removedWraps > 0) lines.push(`#EXT-X-DISCONTINUITY-SEQUENCE:${removedWraps}`);
  for (let number = first; number <= last; number += 1) {
    const source = segments[sourceIndexOf(number, count).index];
    if (number > 0 && number % count === 0) lines.push("#EXT-X-DISCONTINUITY");
    lines.push(`#EXT-X-PROGRAM-DATE-TIME:${new Date(epochMs + number * segmentMs).toISOString()}`);
    lines.push(`#EXTINF:${source.duration.toFixed(3)},`);
    lines.push(virtualSegmentName(number, extensionOf(source.uri)));
  }
  return `${lines.join("\n")}\n`;
}

/** The loop-mode master: the source master with every playlist URI pointing at the virtual routes. */
export function renderMasterPlaylist(sourceMaster) {
  const text = rewriteMasterUris(sourceMaster).trim();
  const withFlag = text.includes("#EXT-X-INDEPENDENT-SEGMENTS")
    ? text
    : text.replace("#EXTM3U", "#EXTM3U\n#EXT-X-INDEPENDENT-SEGMENTS");
  return `${withFlag}\n`;
}
