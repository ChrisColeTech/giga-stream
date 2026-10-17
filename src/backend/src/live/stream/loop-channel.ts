import { KEPT_WINDOWS, SEGMENT_MS, WINDOW_SEGMENTS } from "../../constants/live-media.js";
import type { LoopSource, StreamBackend } from "../../types/live-stream.js";
import {
  parseVirtualSegment,
  renderMasterPlaylist,
  renderMediaPlaylist,
  sourceIndexOf,
  windowAt,
} from "./live-playlist.js";

const MASTER = "master.m3u8";
const MEDIA = "index.m3u8";

/**
 * Loop mode: no encoder. A channel is a sliding window computed from a wall clock over its cached
 * schedule. The clock starts one window "in the past" so the very first playlist is already full, like a
 * stream that has been running. `clock` returns epoch milliseconds and is injectable.
 */
export function createLoopChannel(
  source: LoopSource,
  { clock = Date.now, segmentMs = SEGMENT_MS, windowSize = WINDOW_SEGMENTS } = {},
): StreamBackend {
  const epochMs = clock() - windowSize * segmentMs;
  const elapsed = () => clock() - epochMs;
  const current = () => windowAt({ elapsedMs: elapsed(), segmentMs, windowSize });

  function mediaPlaylist(id: string): Buffer | null {
    const rendition = source.renditions.get(id);
    if (!rendition) return null;
    return Buffer.from(renderMediaPlaylist({ segments: rendition.segments, elapsedMs: elapsed(), epochMs, segmentMs, windowSize }));
  }

  async function segment(id: string, name: string): Promise<Buffer | null> {
    const rendition = source.renditions.get(id);
    const virtual = parseVirtualSegment(name);
    if (!rendition || !virtual) return null;
    const { first, last } = current();
    const oldest = Math.max(0, first - KEPT_WINDOWS * windowSize);
    if (virtual.number > last || virtual.number < oldest) return null;
    return source.readSegment(id, sourceIndexOf(virtual.number, rendition.segments.length).index);
  }

  return {
    mode: "loop",
    renditions: () => [...source.renditions.keys()],
    playlist: () => source.items ?? [],
    /** The video the newest complete segment belongs to, by the first rendition's numbering. */
    nowPlaying() {
      const [timeline] = source.renditions.values();
      const { last } = current();
      if (!timeline || last < 0) return null;
      const index = timeline.segments[sourceIndexOf(last, timeline.segments.length).index]?.item ?? 0;
      const item = source.items?.[index];
      return item ? { index, name: item.name } : null;
    },
    state: () => "live",
    async start() {},
    async stop() {},
    /** Reads a virtual file: [master.m3u8], [rendition, index.m3u8] or [rendition, segNNNNN.ext]. */
    async read(parts) {
      const [head, file] = parts;
      if (parts.length === 1 && head === MASTER) return Buffer.from(renderMasterPlaylist(source.masterText));
      if (parts.length !== 2 || head === undefined || file === undefined) return null;
      return file === MEDIA ? mediaPlaylist(head) : segment(head, file);
    },
  };
}
