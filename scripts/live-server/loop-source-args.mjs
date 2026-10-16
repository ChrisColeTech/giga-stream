import {
  SEGMENT_SECONDS,
  assertItem,
  streamMaps,
  variantFlags,
  varStreamMap,
  videoCodecFlags,
} from "./channel-recipe.mjs";

/**
 * The ffmpeg arguments that encode one video of a channel's playlist, once and whole, into its VOD ladder:
 * the docs/09 section 5 recipe (several video variants, one audio group, WebVTT inside the video variants
 * for a captioned channel), 2-second segments. Run with the item's cache folder as the working directory.
 *
 * The encode is cut to whole segments (`-t`): the live window gives every segment exactly one segment length
 * of clock, and AAC pads the audio a frame past the picture, which would give the audio rendition one more
 * (21 ms) segment than the video and move its switches out of step.
 */
export function buildLoopSourceArgs(channel, item) {
  assertItem(channel, item, "loop-source-args");
  const segments = Math.floor((item.durationMs ?? 0) / (SEGMENT_SECONDS * 1000));
  if (segments < 1) throw new Error(`loop-source-args: ${channel.id}: ${item.path} is shorter than one segment`);
  const args = ["-hide_banner", "-loglevel", "warning", "-nostdin", "-y"];
  args.push("-i", item.path);
  if (channel.captions) args.push("-i", item.captionsPath);
  args.push("-t", String(segments * SEGMENT_SECONDS));
  args.push(...streamMaps(channel));
  args.push(...videoCodecFlags(), ...variantFlags(channel));
  args.push("-c:a", "aac", "-b:a", "96k");
  if (channel.captions) args.push("-c:s", "webvtt");
  args.push("-var_stream_map", varStreamMap(channel));
  args.push("-master_pl_name", "master.m3u8", "-f", "hls", "-hls_time", String(SEGMENT_SECONDS));
  args.push("-hls_playlist_type", "vod", "-hls_segment_filename", "%v/seg%03d.ts", "%v/index.m3u8");
  return args;
}
