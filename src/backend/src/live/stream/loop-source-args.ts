import { SEGMENT_SECONDS } from "../../constants/live-media.js";
import type { PlaylistItem } from "../../types/live-stream.js";
import { type RecipeChannel, streamMaps, variantFlags, varStreamMap, videoCodecFlags } from "./recipe.js";

/**
 * The ffmpeg arguments that encode one video of a channel's playlist, once, into its VOD ladder: the
 * docs/09 section 5 recipe (several video variants, one audio group, WebVTT inside the video variants for a
 * captioned channel), 2-second segments. Run with the video's cache folder as the working directory.
 *
 * The encode is cut to whole segments (`-t`): the live window gives every segment exactly one segment length
 * of clock, so a short tail segment would put the clock out of step.
 */
export function buildLoopSourceArgs(channel: RecipeChannel, item: PlaylistItem): string[] {
  if (channel.captions && !item.captionsPath) throw new Error(`${channel.id}: ${item.name} has no captions file`);
  const segments = Math.floor(item.durationMs / (SEGMENT_SECONDS * 1000));
  if (segments < 1) throw new Error(`${channel.id}: ${item.name} is shorter than one segment`);
  const args = ["-hide_banner", "-loglevel", "warning", "-nostdin", "-y"];
  args.push("-i", item.path);
  if (channel.captions && item.captionsPath) args.push("-i", item.captionsPath);
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
