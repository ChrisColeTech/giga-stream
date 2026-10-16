export const HLS_JS_URL = "https://cdn.jsdelivr.net/npm/hls.js@1.5.20/dist/hls.min.js";

const SCRIPT = `
const params = new URLSearchParams(location.search);
const channel = params.get("channel") || "fx-news";
const video = document.getElementById("v");
const stats = { channel, state: "loading", levels: [], topLevelSeen: -1, fragments: 0, errors: [], playlists: 0 };
window.liveStats = stats;
video.muted = true;
const hls = new Hls({ lowLatencyMode: false });
window.hls = hls;
hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
  stats.levels = data.levels.map((level) => ({ height: level.height, bitrate: level.bitrate }));
});
hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
  stats.level = data.level;
  stats.topLevelSeen = Math.max(stats.topLevelSeen, data.level);
});
hls.on(Hls.Events.LEVEL_LOADED, () => { stats.playlists += 1; });
hls.on(Hls.Events.FRAG_LOADED, () => { stats.fragments += 1; });
hls.on(Hls.Events.ERROR, (_, data) => {
  stats.errors.push({ type: data.type, details: data.details, fatal: data.fatal });
  if (data.fatal) stats.state = "failed";
});
video.addEventListener("playing", () => { stats.state = "playing"; });
video.addEventListener("waiting", () => { if (stats.state !== "failed") stats.state = "buffering"; });
window.retry = () => {
  stats.state = "loading";
  hls.startLoad();
  hls.recoverMediaError();
  video.play().catch(() => {});
};
window.snapshot = () => {
  const quality = video.getVideoPlaybackQuality ? video.getVideoPlaybackQuality() : {};
  return Object.assign({}, stats, {
    currentTime: video.currentTime,
    paused: video.paused,
    ended: video.ended,
    readyState: video.readyState,
    latency: hls.latency,
    audioBytes: video.webkitAudioDecodedByteCount || 0,
    videoBytes: video.webkitVideoDecodedByteCount || 0,
    frames: quality.totalVideoFrames || 0,
    dropped: quality.droppedVideoFrames || 0,
    textTracks: video.textTracks.length,
    audioTracks: hls.audioTracks.length,
    subtitleTracks: hls.subtitleTracks.length,
    levelNames: hls.levels.map((level) => level.height + "p/" + level.bitrate + "/" + level.codecSet),
  });
};
hls.loadSource("/live/" + channel + "/master.m3u8");
hls.attachMedia(video);
video.play().catch(() => {});
`;

/**
 * The tiny player page the browser test drives (served at /test/player.html only when the live
 * server starts with --test-page). It exposes window.snapshot() and window.retry(); hls.js is pinned.
 */
export function playerPage() {
  return [
    "<!doctype html>",
    '<meta charset="utf-8">',
    "<title>live player</title>",
    '<video id="v" muted playsinline autoplay width="640" height="360"></video>',
    `<script src="${HLS_JS_URL}"></script>`,
    `<script>${SCRIPT}</script>`,
  ].join("\n");
}
