/** Named values of "your own files" (docs/03 sections 3.7-3.13; the brief's wiring list). */

/** At most this many runners execute at once; the rest wait as `queued` (3.9, the brief's value). */
export const JOB_CONCURRENCY = 2;

/** The NDJSON catch-up buffer keeps the scan's most recent events for a late client (the brief). */
export const SCAN_EVENT_BUFFER = 2000;

/** A folder selection token is single-use and dies after ten minutes (3.8 default). */
export const SELECTION_TOKEN_TTL_MS = 10 * 60 * 1000;
export const SELECTION_TOKEN_BYTES = 16; // 128 bits of entropy

/** The state answer carries unsettled jobs and the 50 most recent settled ones (03 section 4). */
export const SETTLED_JOB_HISTORY = 50;
