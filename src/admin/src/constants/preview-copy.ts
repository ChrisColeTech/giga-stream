import type { PlayerError } from "@/lib/preview-state";

/* The Preview window's words (`36` section 8, `28` section 7.4). */

export const PREVIEW_TITLE = "Preview";

/** The window's size: standard, opened centred at most 80% of the main window (`50` section 2.7). */
export const PREVIEW_SIZE = { width: 820, body: 560, minWidth: 420, minBody: 330 } as const;

/** The `Online` switch's tooltip on a stream nobody has checked (`51` section 2.6): off until a verdict exists. */
export const UNCHECKED_TITLE = "No check has run on this address yet.";

/** The line while the window reads the channels. */
export const READING_WORD = "loading";

/** The line for a channel that is no longer there (a word); its sentence goes on the notice line. */
export const MISSING_WORD = "missing";

/** The existing `channel.not_found` sentence: the channel is no longer there. */
export const NO_CHANNEL = "That channel does not exist.";

/** The player's errors as the line says them: always a word. */
export const PLAYER_ERROR_TEXT: Readonly<Record<PlayerError, string>> = {
  "manifest failed": "manifest failed",
  unreachable: "unreachable",
  "media error": "media error",
  unsupported: "unsupported",
};

/** The sentence an `unsupported` player says once, on the notice line. */
export const UNSUPPORTED_NOTICE = "This browser cannot play HLS streams.";

/** The HLS type a browser's own player may play when hls.js cannot run. */
export const HLS_TYPE = "application/vnd.apple.mpegurl";

export const PREVIEW_VIDEO_LABEL = "Channel preview";
export const RETRY_LABEL = "Retry";
export const RETRY_READING = "Reading the channels.";
