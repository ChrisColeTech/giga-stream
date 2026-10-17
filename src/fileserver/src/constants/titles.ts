/** The titles pass-through's named limits (docs/03 sections 3.6 and 5.1). */

/** Title details held in memory for the session, oldest dropped (03 section 3.6). */
export const TITLE_SESSION_CAP = 100;

/** Names of cast answered: "at most ten names" (03 section 3.6). */
export const CAST_MAX = 10;

/** How long the backend's health answer stands for the library's availability flags (5.1). */
export const AVAILABILITY_TTL_MS = 30_000;

/** Related rows answered: "at most 20 at first" (`06` section 5.5). */
export const RELATED_MAX = 20;
