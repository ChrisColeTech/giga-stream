/** A rendition a channel may carry: its picture size and video bitrate. */
export interface VariantSpec {
  width: number;
  height: number;
  bitrate: string;
}

/** The ladder every channel draws its variants from (docs/09 section 5). */
export const VARIANT_LADDER = {
  "360p": { width: 640, height: 360, bitrate: "800k" },
  "720p": { width: 1280, height: 720, bitrate: "2500k" },
  "1080p": { width: 1920, height: 1080, bitrate: "5000k" },
} as const satisfies Record<string, VariantSpec>;

export type VariantName = keyof typeof VARIANT_LADDER;
export const VARIANT_NAMES = Object.keys(VARIANT_LADDER) as [VariantName, ...VariantName[]];
export const DEFAULT_VARIANTS: VariantName[] = ["360p", "720p"];

export const CATEGORIES = ["News", "Sports", "Music", "Kids", "Movies", "Entertainment"] as const;
export const MODES = ["loop", "encode"] as const;

export const FRAME_RATE = 30;
export const SEGMENT_SECONDS = 2;
export const SEGMENT_MS = SEGMENT_SECONDS * 1000;
/** Segments in a live window. */
export const WINDOW_SEGMENTS = 6;
/** Loop mode keeps segments this many windows behind the live edge, like an encoder's deleted files. */
export const KEPT_WINDOWS = 3;

export const AUDIO_RENDITION = "audio";
export const AUDIO_GROUP = "aud";
export const SUBTITLE_GROUP = "sub";
/** A video's caption file sits beside it: `clip.mp4` → `clip.en.srt`. */
export const CAPTIONS_SUFFIX = ".en.srt";

/** Bumped whenever the loop encode's shape changes; each cached encode's marker holds it. */
export const RECIPE_VERSION = "4";

/** Encode mode: a restart's segment numbers start this far on, so a cache never serves the old run's bytes. */
export const SEGMENT_NUMBER_STRIDE = 100_000;
export const ENCODER_STABLE_UPTIME_MS = 10_000;
export const ENCODER_MAX_FAST_FAILURES = 5;
export const ENCODER_STOP_WAIT_MS = 5_000;
export const ENCODER_LOG_LIMIT = 16 * 1024;

export const PLAYLIST_CACHE = "no-store";
export const SEGMENT_CACHE = "public, max-age=31536000, immutable";

/** The player the test page loads, pinned. */
export const HLS_JS_URL = "https://cdn.jsdelivr.net/npm/hls.js@1.5.20/dist/hls.min.js";
