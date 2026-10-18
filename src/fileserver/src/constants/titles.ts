/** The titles pass-through's named limits (docs/03 sections 3.6 and 5.1). */

/** Longest title id a title route accepts; mirrors the backend's own bound (docs/03 section 7.4), which
 * admits manual ids such as `custom-<uuid>` (43 characters). The programs never import each other. */
export const TITLE_ID_MAX = 60;

/** Shortest title id a title route accepts (the backend's bound too). */
export const TITLE_ID_MIN = 3;

/** Title details held in memory for the session, oldest dropped (03 section 3.6). */
export const TITLE_SESSION_CAP = 100;

/** Names of cast answered: "at most ten names" (03 section 3.6). */
export const CAST_MAX = 10;

/** How long the backend's health answer stands for the library's availability flags (5.1). */
export const AVAILABILITY_TTL_MS = 30_000;

/** Related rows answered: "at most 20 at first" (`06` section 5.5). */
export const RELATED_MAX = 20;
