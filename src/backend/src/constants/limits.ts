/** Named limits (`01` section 5: no configuration literals where they are used). */

export const REQUEST_BODY_LIMIT_BYTES = 65_536;

export const CHANNEL_NAME_MAX = 120;
export const CHANNEL_CATEGORY_MAX = 60;
export const CHANNEL_NUMBER_MAX = 12;
export const ADDRESS_MAX = 2048;

// Providers (docs/03 section 7.2b).
export const PROVIDER_NAME_MAX = 120;
export const SOURCE_MAX = 60;
export const API_KEY_MAX = 256;

// Accounts and sign-in (docs/03 sections 7.11 and 7.12).
export const ACCOUNT_NAME_MAX = 80;
export const EMAIL_MAX = 254;
export const PASSWORD_MIN = 12;
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

// The socket (section 7.8): a client may send only `ping`, so frames are tiny.
export const SOCKET_MAX_PAYLOAD_BYTES = 1024;
export const SOCKET_QUEUE_LIMIT = 64;
export const SOCKET_VIOLATION_LIMIT = 5;
export const SOCKET_CLOSE_POLICY = 1008;
export const SOCKET_CLOSE_OVERLOAD = 1013;
export const SOCKET_CLOSE_GOING_AWAY = 1001;

export const DATABASE_BUSY_TIMEOUT_MS = 5000;
