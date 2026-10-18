/* Browse TMDB's words (`docs/47` section 4, `docs/01` section 9 verb tables): the explicit `Add`, its tips and disabled
 * reasons, and the notices. Copy lives here, never in a component. */

export const ADD_LABEL = "Add";
export const ADD_TIP = "Add this title to the store";

/** Disabled reasons of `Add` and `Open` on a Browse row. */
export const ADD_STORED = "Already stored.";
export const ADD_DELETED = "Deleted earlier; restore it under Deleted titles.";
export const ADDING_REASON = "Adding.";
export const OPEN_UNSTORED = "Not stored yet. Add it to open it.";
