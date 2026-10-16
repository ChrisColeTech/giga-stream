import { VARIANT_LADDER } from "./channel-catalog.mjs";

export const FRAME_RATE = 30;
export const SEGMENT_SECONDS = 2;
export const AUDIO_RENDITION = "audio";
export const AUDIO_GROUP = "aud";
export const SUBTITLE_GROUP = "sub";

/** Bumped whenever the loop source's shape changes; the cache marker holds it. */
export const RECIPE_VERSION = "4";

/** The variants of a channel with their ladder entries, in the channel's own order. */
export function variantsOf(channel) {
  return channel.variants.map((name) => ({ name, ...VARIANT_LADDER[name] }));
}

/**
 * The -var_stream_map value. The hls muxer takes subtitles only inside a video variant (s:N beside
 * v:N), so a captioned channel carries one subtitle stream per video variant. Audio is its own
 * rendition in the shared group.
 */
export function varStreamMap(channel) {
  const entries = variantsOf(channel).map((variant, index) => {
    const parts = [`v:${index}`];
    if (channel.captions) parts.push(`s:${index}`);
    parts.push(`agroup:${AUDIO_GROUP}`);
    if (channel.captions) parts.push(`sgroup:${SUBTITLE_GROUP}`);
    parts.push(`name:${variant.name}`);
    return parts.join(",");
  });
  entries.push(`a:0,agroup:${AUDIO_GROUP},language:en,name:${AUDIO_RENDITION}`);
  return entries.join(" ");
}

/** Per-variant picture size and bitrate flags, indexed by output stream (-s:v:N, -b:v:N). */
export function variantFlags(channel) {
  return variantsOf(channel).flatMap((variant, index) => [
    `-s:v:${index}`, `${variant.width}x${variant.height}`, `-b:v:${index}`, variant.bitrate,
  ]);
}

/**
 * The maps for the video input (input 0: its video, once per variant, and its audio) and, for a
 * captioned channel, the caption input (input 1, once per variant).
 */
export function streamMaps(channel) {
  const variants = variantsOf(channel).length;
  const maps = [];
  for (let index = 0; index < variants; index += 1) maps.push("-map", "0:v:0");
  maps.push("-map", "0:a:0");
  if (channel.captions) for (let index = 0; index < variants; index += 1) maps.push("-map", "1:s:0");
  return maps;
}

/** Video encoder settings shared by encode mode and the loop source (the verified shape). */
export function videoCodecFlags() {
  return [
    "-c:v", "libx264", "-preset", "veryfast", "-tune", "zerolatency", "-pix_fmt", "yuv420p",
    "-g", String(FRAME_RATE * SEGMENT_SECONDS), "-sc_threshold", "0",
  ];
}

/** Refuses a video that was not loaded, or one of a captioned channel without its captions. */
export function assertItem(channel, item, who) {
  if (!item?.path) throw new Error(`${who}: ${channel.id} needs its video file`);
  if (channel.captions && !item.captionsPath) throw new Error(`${who}: ${channel.id} needs its captions file`);
}
