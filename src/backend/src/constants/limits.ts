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
export const ACCOUNT_NAME_MAX = 80;
export const EMAIL_MAX = 254;
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

// The sync settings (docs/26 section 3.11).
export const PLAYLISTS_MAX = 20;

// The playlist sync (docs/03 section 7.2c).
export const PLAYLIST_FETCH_TIMEOUT_MS = 15_000;
export const TVG_ID_MAX = 128;
export const PLAYLIST_SYNC_EXAMPLES_MAX = 10;

// The iptv-org logo index the sync enriches from (docs/03 section 7.2c, "Enrichment").
export const LOGO_INDEX_TIMEOUT_MS = 15_000;
export const LOGO_INDEX_MAX_BYTES = 8 * 1024 * 1024;

export const DATABASE_BUSY_TIMEOUT_MS = 5000;
