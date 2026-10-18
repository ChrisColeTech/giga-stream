/** Named limits (`01` section 5: no configuration literals where they are used). */

export const REQUEST_BODY_LIMIT_BYTES = 65_536;

export const CHANNEL_NAME_MAX = 120;
export const CHANNEL_CATEGORY_MAX = 60;
export const CHANNEL_NUMBER_MAX = 12;
export const ADDRESS_MAX = 2048;

// Live channels (docs/10 section 3.1). A live id is kebab-case; a number is a whole 1 to 9999 on the wire as text.
export const LIVE_ID_MAX = 64;
export const LIVE_NUMBER_MIN = 1;
export const LIVE_NUMBER_MAX = 9_999;
export const PATH_MAX = 1_024;
/** Videos one live channel may list by path; a larger set belongs in a folder. */
export const CHANNEL_VIDEOS_MAX = 2_000;
export const FAULT_DURATION_MAX_MS = 24 * 60 * 60 * 1000;
/** A channel write may carry up to CHANNEL_VIDEOS_MAX paths, which the default body limit would refuse. */
export const CHANNEL_BODY_LIMIT_BYTES = 256 * 1024;

// Providers (docs/03 section 7.2b).
export const PROVIDER_NAME_MAX = 120;
export const SOURCE_MAX = 60;
export const PARAM_MAX = 60;
export const FRAME_ORIGINS_MAX = 8;

// Accounts and sign-in (docs/03 sections 7.11 and 7.12).
export const USERNAME_MAX = 254;
export const PASSWORD_MIN = 1;
export const PASSWORD_MAX = 256;
export const JWT_SECRET_MIN = 32;
export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const REFRESH_TOKEN_BYTES = 32;
export const SIGN_IN_ATTEMPTS_PER_WINDOW = 10;
export const SIGN_IN_WINDOW_MS = 60 * 1000;
export const LOCKOUT_FAILURES = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;

// The audit log (section 7.13).
export const AUDIT_PAGE_DEFAULT = 50;
export const AUDIT_PAGE_MAX = 200;

// The admin's long lists (docs/41 section 3): a page is 100 rows by default, at most 200, as the audit page.
export const LIST_PAGE_DEFAULT = 100;
export const LIST_PAGE_MAX = 200;
/** No real list is near this; it only keeps a hostile offset from becoming an unbounded scan. */
export const LIST_OFFSET_MAX = 10_000_000;
export const CHANNEL_SEARCH_MAX = 120;
export const TITLE_SEARCH_MAX = 200;

// The playlist import and sync (docs/03 section 7.2c, docs/43 sections 3.2 and 3.4).
export const PLAYLIST_FETCH_TIMEOUT_MS = 15_000;
/** The hard cap on an uploaded or fetched playlist: past it is an error, never a silent truncation. */
export const PLAYLIST_IMPORT_MAX_BYTES = 8 * 1024 * 1024;
/** `@fastify/multipart` header pairs one upload may carry. */
export const PLAYLIST_UPLOAD_HEADER_PAIRS = 20;
/** Bytes a multipart envelope adds around the file part, so the route's body limit sits just above the file cap. */
export const PLAYLIST_UPLOAD_OVERHEAD_BYTES = 64 * 1024;
export const PLAYLIST_NAME_MAX = 120;
/** The M3U detection window: an `#EXTINF` within this many lines proves a playlist with no `#EXTM3U` header. */
export const M3U_DETECT_LINES = 20;
export const TVG_ID_MAX = 128;
export const PLAYLIST_SYNC_EXAMPLES_MAX = 10;
/** A playlist's sync job starts at this schedule and may never be set faster (a web playlist is re-fetched each run). */
export const PLAYLIST_JOB_DEFAULT_SCHEDULE = "24h";
export const PLAYLIST_SCHEDULE_MIN_MS = 15 * 60 * 1000;
/** The scheduler never fires earlier than process start plus this, so a due-at-once job never runs during boot. */
export const FIRST_RUN_GRACE_MS = 30_000;
/** A playlist delete waits this long for the aborted run to settle before it deletes anyway. */
export const PLAYLIST_DELETE_SETTLE_MS = 10_000;

// The iptv-org logo index the sync enriches from (docs/03 section 7.2c, "Enrichment").
export const LOGO_INDEX_TIMEOUT_MS = 15_000;
export const LOGO_INDEX_MAX_BYTES = 8 * 1024 * 1024;

export const DATABASE_BUSY_TIMEOUT_MS = 5000;
