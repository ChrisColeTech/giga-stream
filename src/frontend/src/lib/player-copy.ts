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
