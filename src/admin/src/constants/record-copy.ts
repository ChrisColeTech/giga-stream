/* The sentences every tab shares: tooltips, disabled reasons and notices (`28` section 6.1). Copy lives here, never in a
 * component, so a refusal reads the same on every page. */

/** An index verb that acts on ticked rows, with none ticked, or with more than it takes. */
export const TICK_FIRST = "Tick a row first";
export const TICK_JOB_FIRST = "Tick a job first";
export const TICK_ONE = "Tick only one row";

/** A workspace verb that needs a saved record. */
export const SAVE_FIRST = "Save the channel first";

/** Save and Discard while the draft equals its baseline. */
export const NOTHING_CHANGED = "Nothing has changed.";

export const LAST_ACCOUNT = "The last enabled account cannot be deleted.";

/** The titlebar's pane toggles (`28` section 7.1): the rail exists on a workspace only; the admin has no right pane. */
export const NO_LEFT_PANE = "This page has no left pane.";
export const NO_RIGHT_PANE = "The admin has no right pane.";
export const EVENTS_TOGGLE_NAME = "the events band";

/** A modal window puts the tabs and the pane toggles to sleep (`28` Appendix A, row 7). */
export const SLEEPING_TABS = "Close the open window to switch tabs.";
export const SLEEPING_PANES = "Close the open window to change the panes.";

/** Why Stop is never available (`26` section 4.2; `28` section 7.1): no route stops a build or a sync. */
export const STOP_IDLE = "Nothing to stop";
export const STOP_BUILD = "A channel build cannot be cancelled; change or delete the channel.";
export const STOP_SYNC = "A sync cannot be cancelled.";

/** A key's notice. */
export const ZOOM_RESET_NOTICE = "Zoom reset to 100%.";
