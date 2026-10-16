const TYPES = {
  m3u8: "application/vnd.apple.mpegurl",
  ts: "video/mp2t",
  vtt: "text/vtt",
  m4s: "video/mp4",
  mp4: "video/mp4",
  aac: "audio/aac",
  png: "image/png",
  json: "application/json",
  html: "text/html; charset=utf-8",
};

export const PLAYLIST_CACHE = "no-store";
export const SEGMENT_CACHE = "public, max-age=31536000, immutable";

/** The content type for a file name by extension; unknown extensions are plain bytes. */
export function mimeOf(name) {
  const extension = name.split(".").at(-1)?.toLowerCase() ?? "";
  return TYPES[extension] ?? "application/octet-stream";
}

export function isPlaylist(name) {
  return name.toLowerCase().endsWith(".m3u8");
}
