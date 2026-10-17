/* The Player's copy and limits, in one place: every reason a control is disabled, and the counts the spec names. Phase 1
 * has no fileserver, so every reason says what is missing and where it is wired. */

/** `06` section 5.5: at most twenty related cards. */
export const RELATED_LIMIT = 20;

/** `06` section 5.2: the skeleton count of the episode browser. */
export const EPISODE_SKELETON_COUNT = 10;

/** `06` section 5.2: the browser's loading and empty rows. */
export const BROWSER_SKELETON_COUNT = 10;

/** The inspector's loading rows, with no tab open. */
export const INSPECTOR_SKELETON_COUNT = 8;

/* Every reason names its cause in plain words. A control is disabled only when there is nothing for it to act on. */
export const NO_WATCH_ENTRY_REASON = "No watch entry is recorded for this title.";
export const NO_SEASONS_REASON = "This title lists no seasons.";
/** How long an armed Remove from History waits for its second press before it disarms (`06` section 2, rule 9). */
export const ARM_TIMEOUT_MS = 5000;
export const REMOVE_HISTORY_LABEL = "Remove from History";
export const CONFIRM_REMOVE_LABEL = "Confirm removal";

export const FULLSCREEN_LABEL = "Full screen";
export const EXIT_FULLSCREEN_LABEL = "Exit full screen";
