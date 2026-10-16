/** The Live surface's copy and numbers, in one place (`01` section 5). The reasons are the tooltips of `06` section 3;
 *  no sentence here is printed under a control. */

/** Skeleton rows drawn while the channel list loads or has nothing to show (`06` section 3.2). */
export const LIST_SKELETON_ROWS = 14;

/** The category value that means every channel. */
export const ALL_CATEGORY = "all";

/** The readout of a value the phase 1 build cannot know, and of a detail with no channel selected. */
export const EMPTY_VALUE = "—";

/** The marker on the channel the player has loaded (`06` section 3.2). */
export const PLAYING_MARKER = "live";

export const CHANNELS_HEADING = "Channels";
export const SEARCH_LABEL = "Search channels";
export const CLEAR_SEARCH_LABEL = "Clear search";
export const CATEGORY_LABEL = "Category";
export const ALL_CATEGORY_LABEL = "All";
export const CHANNEL_LIST_LABEL = "Channels";
export const REFRESH_LABEL = "Refresh channels";
export const DETAILS_HEADING = "Details";
export const DETAILS_SECTION_ID = "live.details";
export const PLAYER_LABEL = "Live player";
export const PICTURE_FIT_LABEL = "Picture fit";

export const STREAM_NOTE_TITLE = "This stream will not play";
export const STREAM_NOTE_SENTENCE = "The stream did not start. Retry loads the same address again.";
export const RETRY_LABEL = "Retry";
export const NO_CHANNELS_TITLE = "No channels";
export const NO_CHANNELS_SENTENCE = "The channel list is empty.";

/** `06` section 3.1 and 3.2 tooltips for the phase 1 disabled controls. */
export const REASON_NEEDS_PLAYING = "Available once a channel is playing.";
export const REASON_NEEDS_STREAM_FAILURE = "Available once a channel's stream has failed to start.";
export const REASON_NEEDS_FILESERVER = "The fileserver is not connected.";

export const PLAYBACK_SECTION_TITLES = {
  video: "Video",
  display: "Display",
  audio: "Audio",
  captions: "Captions",
  playback: "Playback",
} as const;
