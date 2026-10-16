// The fixture files (docs/10 section 2.1): what each test video is made from. Raising FIXTURE_VERSION
// remakes every file on the next run (a new cache folder).

export const FIXTURE_VERSION = 2;

/**
 * The live channels' programmes, three per channel, in playlist order. `picture` is an FFmpeg source
 * (`testsrc2`, `smptehdbars`, `mandelbrot`, or `color` with `color`), `post` optional filters after it.
 * `captions` names the programme in its caption cues; only the captioned channel's programmes have them.
 */
export const PROGRAMMES = [
  { file: "live/news-1.mp4", picture: "testsrc2", post: "", toneHz: 440, seconds: 30, captions: "News programme 1" },
  { file: "live/news-2.mp4", picture: "testsrc2", post: "hue=h=90", toneHz: 494, seconds: 20, captions: "News programme 2" },
  { file: "live/news-3.mp4", picture: "testsrc2", post: "hue=h=200", toneHz: 523, seconds: 40, captions: "News programme 3" },
  { file: "live/sports-1.mp4", picture: "smptehdbars", post: "", toneHz: 660, seconds: 40 },
  { file: "live/sports-2.mp4", picture: "smptehdbars", post: "hflip", toneHz: 698, seconds: 30 },
  { file: "live/sports-3.mp4", picture: "color", color: "0x22aa44", post: "", toneHz: 740, seconds: 20 },
  { file: "live/music-1.mp4", picture: "mandelbrot", post: "", toneHz: 880, seconds: 20 },
  { file: "live/music-2.mp4", picture: "mandelbrot", post: "hue=h=120", toneHz: 988, seconds: 40 },
  { file: "live/music-3.mp4", picture: "color", color: "0x7a2ea8", post: "", toneHz: 1047, seconds: 30 },
  { file: "live/kids-1.mp4", picture: "testsrc2", post: "hflip,hue=h=120", toneHz: 550, seconds: 20 },
  { file: "live/kids-2.mp4", picture: "color", color: "0xff8a00", post: "", toneHz: 587, seconds: 30 },
  { file: "live/kids-3.mp4", picture: "testsrc2", post: "hflip,hue=h=300", toneHz: 622, seconds: 40 },
];

export const LIVE_SIZE = { width: 1920, height: 1080 };
export const LIVE_FPS = 30;
/** A keyframe every 2 s, so the 2 s HLS segments cut cleanly. */
export const KEYFRAME_SECONDS = 2;
export const CAPTION_EVERY_SECONDS = 5;

/** A programme's caption file sits beside it: `live/news-1.mp4` → `live/news-1.en.srt`. */
export const captionsFileOf = (file) => file.replace(/\.mp4$/, ".en.srt");
