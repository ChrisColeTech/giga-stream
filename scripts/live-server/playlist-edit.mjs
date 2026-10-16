const SEQUENCE = /^#EXT-X-MEDIA-SEQUENCE:(\d+)\s*$/m;
const DISCONTINUITY_SEQUENCE = /^#EXT-X-DISCONTINUITY-SEQUENCE:\d+\s*$/m;
const FIRST_SEGMENT_LINE = /^(#EXT-X-PROGRAM-DATE-TIME|#EXTINF)/m;

/** The playlist's EXT-X-MEDIA-SEQUENCE (0 when absent). */
export function readSequence(text) {
  const match = SEQUENCE.exec(text);
  return match ? Number(match[1]) : 0;
}

/** Replaces (or inserts after the header) the media sequence. */
export function setSequence(text, value) {
  const line = `#EXT-X-MEDIA-SEQUENCE:${value}`;
  if (SEQUENCE.test(text)) return text.replace(SEQUENCE, line);
  return text.replace("#EXTM3U", `#EXTM3U\n${line}`);
}

/** Sets EXT-X-DISCONTINUITY-SEQUENCE directly after the media sequence line. */
export function setDiscontinuitySequence(text, value) {
  const line = `#EXT-X-DISCONTINUITY-SEQUENCE:${value}`;
  if (DISCONTINUITY_SEQUENCE.test(text)) return text.replace(DISCONTINUITY_SEQUENCE, line);
  return text.replace(SEQUENCE, (found) => `${found.trimEnd()}\n${line}`);
}

/** Puts EXT-X-DISCONTINUITY before the first segment unless it is already there. */
export function markDiscontinuityAtStart(text) {
  const match = FIRST_SEGMENT_LINE.exec(text);
  if (!match || text.slice(0, match.index).trimEnd().endsWith("#EXT-X-DISCONTINUITY")) return text;
  return `${text.slice(0, match.index)}#EXT-X-DISCONTINUITY\n${text.slice(match.index)}`;
}

/** Appends EXT-X-ENDLIST (once): the stream has ended. */
export function appendEndlist(text) {
  if (text.includes("#EXT-X-ENDLIST")) return text;
  return `${text.trimEnd()}\n#EXT-X-ENDLIST\n`;
}
