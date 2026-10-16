import {
  DEFAULT_SEGMENT_MS,
  DEFAULT_WINDOW,
  parseVirtualSegment,
  renderMasterPlaylist,
  renderMediaPlaylist,
  sourceIndexOf,
  windowAt,
} from "./live-playlist.mjs";

const MASTER = "master.m3u8";
const MEDIA = "index.m3u8";
/** Segments older than this many windows are gone, like a real encoder's deleted files. */
const KEPT_WINDOWS = 3;

/**
 * Loop mode: no encoder. A channel is a sliding window computed from a wall clock over a cached
 * source (`loadLoopSource`'s shape: { masterText, renditions, readSegment }). The clock starts one
 * window "in the past" so the very first playlist is already full, like a stream that has been
 * running. `clock` returns epoch milliseconds and is injectable.
 */
export function createLoopChannel({
  channel,
  source,
  clock = Date.now,
  segmentMs = DEFAULT_SEGMENT_MS,
  windowSize = DEFAULT_WINDOW,
}) {
  const epochMs = clock() - windowSize * segmentMs;
  const elapsed = () => clock() - epochMs;

  function mediaPlaylist(id) {
    const rendition = source.renditions.get(id);
    if (!rendition) return null;
    const text = renderMediaPlaylist({
      segments: rendition.segments,
      elapsedMs: elapsed(),
      epochMs,
      segmentMs,
      windowSize,
    });
    return Buffer.from(text);
  }

  async function segment(id, name) {
    const rendition = source.renditions.get(id);
    const virtual = parseVirtualSegment(name);
    if (!rendition || !virtual) return null;
    const { first, last } = windowAt({ elapsedMs: elapsed(), segmentMs, windowSize });
    const oldest = Math.max(0, first - KEPT_WINDOWS * windowSize);
    if (virtual.number > last || virtual.number < oldest) return null;
    const { index } = sourceIndexOf(virtual.number, rendition.segments.length);
    return source.readSegment(id, index);
  }

  return {
    id: channel.id,
    mode: "loop",
    renditions: () => [...source.renditions.keys()],
    state: () => "live",
    logTail: () => "",
    async start() {},
    async stop() {},
    /** Reads a virtual file: [master.m3u8], [rendition, index.m3u8] or [rendition, segNNNNN.ext]. */
    async read(parts) {
      if (parts.length === 1 && parts[0] === MASTER) return Buffer.from(renderMasterPlaylist(source.masterText));
      if (parts.length !== 2) return null;
      return parts[1] === MEDIA ? mediaPlaylist(parts[0]) : segment(parts[0], parts[1]);
    },
  };
}
