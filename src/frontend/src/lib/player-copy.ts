/* The Player's copy and limits, in one place: every reason a control is disabled, and the counts the spec names. */

/** `06` section 5.5: at most twenty related cards. */
export const RELATED_LIMIT = 20;

/** `06` section 5.2: the skeleton count of the episode browser. */
export const EPISODE_SKELETON_COUNT = 10;

/** `06` section 5.2: the browser's loading and empty rows. */
export const BROWSER_SKELETON_COUNT = 10;

/** The inspector's loading rows, with no tab open. */
export const INSPECTOR_SKELETON_COUNT = 8;

/* Every reason names its cause in plain words. A control is disabled only when there is nothing for it to act on. */
export const NO_SEASONS_REASON = "This title lists no seasons.";
export const NO_TITLE_SOURCE_REASON = "No stream source is set up for titles.";
export const LOCAL_MEDIA_FAILURE = "The file could not be read. It may have moved since the last scan.";
export const STREAM_FAILURE = "The stream could not be loaded.";
export const PLAYER_LOADING_REASON = "The player is loading this item.";
export const EPISODE_LOADING_REASON = "Episode navigation is loading.";
export const EPISODE_READ_FAILURE_REASON = "Episode navigation could not be loaded.";
export const EPISODE_SWITCH_REASON = "Episode navigation is in progress.";
export const FIRST_EPISODE_REASON = "This is the first episode.";
export const LAST_EPISODE_REASON = "This is the last episode.";
export const UNSUPPORTED_RESUME_REASON = "This source does not support resuming at a saved position.";
/** A title answered from the fileserver's cache (`fromCache`, `46` section E): no sources, so Play is disabled. */
export const BACKEND_UNREACHABLE_REASON = "The admin backend is not reachable.";

export const sourceFailureReason = (local: boolean, reason?: string): string =>
  reason ?? (local ? LOCAL_MEDIA_FAILURE : NO_TITLE_SOURCE_REASON);
