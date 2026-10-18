/** Entries read per page: after sign-in, on a list Refresh and for `Load older` (`29` section 11). */
export const AUDIT_PAGE = 50;

/** Entries read once after one of the page's own writes, enough to show what it just did. */
export const AUDIT_AFTER_WRITE = 10;

/** Said when the history cannot be read and the refusal carries no sentence of its own. */
export const AUDIT_REFUSED = "The history could not be read.";
