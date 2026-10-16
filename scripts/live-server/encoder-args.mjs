import {
  AUDIO_RENDITION,
  SEGMENT_SECONDS,
  streamMaps,
  variantFlags,
  variantsOf,
  varStreamMap,
  videoCodecFlags,
} from "./channel-recipe.mjs";

export const WINDOW_SEGMENTS = 6;
const HLS_FLAGS = "delete_segments+program_date_time+independent_segments";

/** Names of the renditions an encode-mode channel writes, in master order. */
export function renditionNames(channel) {
  return [...variantsOf(channel).map((variant) => variant.name), AUDIO_RENDITION];
}

/**
 * The ffmpeg argument vector for one real-time live channel (docs/10 section 2): the channel's playlist
 * (`inputs.listPath`, a concat-demuxer list) read at its own pace and looped forever (`-re -stream_loop -1`),
 * encoded into the live ladder; a captioned channel also reads the joined `inputs.captionsPath`. Run it with
 * the channel's output folder as the working directory. `startNumber` offsets segment numbers after a
 * restart so a cache never serves the old run's bytes under a new run's name.
 */
export function buildEncoderArgs(channel, inputs, { startNumber = 0 } = {}) {
  if (!inputs?.listPath) throw new Error(`encoder-args: ${channel.id} needs its playlist list`);
  if (channel.captions && !inputs.captionsPath) throw new Error(`encoder-args: ${channel.id} needs its captions file`);
  const args = ["-hide_banner", "-loglevel", "warning", "-nostdin"];
  args.push("-re", "-stream_loop", "-1", "-f", "concat", "-safe", "0", "-i", inputs.listPath);
  if (channel.captions) args.push("-re", "-stream_loop", "-1", "-i", inputs.captionsPath);
  args.push(...streamMaps(channel));
  args.push(...videoCodecFlags(), ...variantFlags(channel));
  args.push("-c:a", "aac", "-b:a", "96k");
  if (channel.captions) args.push("-c:s", "webvtt");
  args.push("-f", "hls", "-hls_time", String(SEGMENT_SECONDS), "-hls_list_size", String(WINDOW_SEGMENTS));
  args.push("-hls_flags", HLS_FLAGS);
  if (startNumber > 0) args.push("-start_number", String(startNumber));
  args.push("-master_pl_name", "master.m3u8", "-var_stream_map", varStreamMap(channel));
  args.push("-hls_segment_filename", "%v/seg%05d.ts", "%v/index.m3u8");
  return args;
}
