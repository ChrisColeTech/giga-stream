/** The rendition id a playlist URI maps to: `360p/index.m3u8` becomes `360p`, `sub_vtt.m3u8` `sub_vtt`. */
export function renditionIdOf(uri) {
  return uri.replace(/\.m3u8$/i, "").replace(/\/index$/, "");
}

/** Every playlist a master points at, in order and without repeats (stream variants and media). */
export function masterPlaylistUris(masterText) {
  const found = [];
  const add = (uri) => {
    if (uri && !found.includes(uri)) found.push(uri);
  };
  for (const line of masterText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    if (!trimmed.startsWith("#")) add(trimmed);
    else for (const match of trimmed.matchAll(/URI="([^"]+)"/g)) add(match[1]);
  }
  return found;
}

/** The segments of a finished media playlist: [{ uri, duration }] with duration in seconds. */
export function parseSegments(playlistText) {
  const segments = [];
  let duration = null;
  for (const line of playlistText.split(/\r?\n/)) {
    const trimmed = line.trim();
    const info = /^#EXTINF:([\d.]+)/.exec(trimmed);
    if (info) duration = Number(info[1]);
    else if (trimmed !== "" && !trimmed.startsWith("#") && duration !== null) {
      segments.push({ uri: trimmed, duration });
      duration = null;
    }
  }
  return segments;
}

/** Rewrites every playlist URI of a master to `<renditionId>/index.m3u8`. */
export function rewriteMasterUris(masterText) {
  const rewrite = (uri) => `${renditionIdOf(uri)}/index.m3u8`;
  return masterText
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed === "") return line;
      if (!trimmed.startsWith("#")) return rewrite(trimmed);
      return trimmed.replace(/URI="([^"]+)"/g, (_, uri) => `URI="${rewrite(uri)}"`);
    })
    .join("\n");
}
