import { SEGMENT_MS, WINDOW_SEGMENTS } from "../../constants/live-media.js";
import type { Segment } from "../../types/live-stream.js";
import { rewriteMasterUris } from "./playlist-parse.js";

interface WindowOptions {
  elapsedMs: number;
  segmentMs?: number;
  windowSize?: number;
}

/**
 * The sliding window at a wall-clock moment. Segment k is complete once (k+1) segment lengths have
 * elapsed, so the newest complete segment is floor(elapsed / length) - 1 and the window holds the
 * `windowSize` segments up to it. The media sequence advances by one every segment length.
 */
export function windowAt({ elapsedMs, segmentMs = SEGMENT_MS, windowSize = WINDOW_SEGMENTS }: WindowOptions) {
  const completed = Math.max(0, Math.floor(elapsedMs / segmentMs));
  return { first: Math.max(0, completed - windowSize), last: completed - 1 };
}

/** The virtual segment file name: number padded to five digits, with the source extension. */
export function virtualSegmentName(number: number, extension: string): string {
  return `seg${String(number).padStart(5, "0")}.${extension}`;
}

/** Parses a virtual segment name back to { number, extension }, or null when it is not one. */
export function parseVirtualSegment(name: string): { number: number; extension: string } | null {
  const match = /^seg(\d{5,})\.([a-z0-9]+)$/.exec(name);
  return match?.[1] && match[2] ? { number: Number(match[1]), extension: match[2] } : null;
}

/** Which source segment a virtual number plays, and how many loop wraps happened before it. */
export function sourceIndexOf(number: number, count: number) {
  return { index: number % count, cycle: Math.floor(number / count) };
}

/** Whether a source segment begins a video (a schedule marks them; a lone source begins only at 0). */
const beginsItem = (segment: Segment, index: number): boolean => segment.itemStart ?? index === 0;

/** How many of the virtual numbers 0 .. end-1 begin a video. */
function itemStartsBefore(end: number, segments: Segment[]): number {
  const starts = segments.map(beginsItem);
  const perCycle = starts.filter(Boolean).length;
  const tail = starts.slice(0, end % segments.length).filter(Boolean).length;
  return Math.floor(end / segments.length) * perCycle + tail;
}

/**
 * A live media playlist computed from the wall clock over a looping source or schedule. `epochMs` is
 * the wall time of virtual segment 0; program date-time advances by one segment length per number.
 * Every switch to a video (and the wrap back to the first) carries EXT-X-DISCONTINUITY, and the
 * playlist counts the ones that left the window. Never ends.
 */
export function renderMediaPlaylist(options: WindowOptions & { segments: Segment[]; epochMs: number }): string {
  const { segments, epochMs, segmentMs = SEGMENT_MS } = options;
  const { first, last } = windowAt(options);
  const target = Math.ceil(Math.max(...segments.map((segment) => segment.duration)));
  // Number 0 begins the stream, so its start is no discontinuity; every later one is.
  const removed = first >= 1 ? itemStartsBefore(first, segments) - 1 : 0;
  const lines = ["#EXTM3U", "#EXT-X-VERSION:3", `#EXT-X-TARGETDURATION:${target}`, `#EXT-X-MEDIA-SEQUENCE:${first}`];
  if (removed > 0) lines.push(`#EXT-X-DISCONTINUITY-SEQUENCE:${removed}`);
  for (let number = first; number <= last; number += 1) {
    const { index } = sourceIndexOf(number, segments.length);
    const source = segments[index];
    if (!source) continue;
    if (number > 0 && beginsItem(source, index)) lines.push("#EXT-X-DISCONTINUITY");
    lines.push(`#EXT-X-PROGRAM-DATE-TIME:${new Date(epochMs + number * segmentMs).toISOString()}`);
    lines.push(`#EXTINF:${source.duration.toFixed(3)},`);
    lines.push(virtualSegmentName(number, source.uri.split(".").at(-1) ?? "ts"));
  }
  return `${lines.join("\n")}\n`;
}

/** The loop-mode master: the source master with every playlist URI pointing at the virtual routes. */
export function renderMasterPlaylist(sourceMaster: string): string {
  const text = rewriteMasterUris(sourceMaster).trim();
  const withFlag = text.includes("#EXT-X-INDEPENDENT-SEGMENTS")
    ? text
    : text.replace("#EXTM3U", "#EXTM3U\n#EXT-X-INDEPENDENT-SEGMENTS");
  return `${withFlag}\n`;
}
