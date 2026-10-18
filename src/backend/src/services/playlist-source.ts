import { AppError, ERRORS } from "../constants/errors.js";
import { PLAYLIST_FETCH_TIMEOUT_MS } from "../constants/limits.js";
import { SafeFetchError, type SafeFetch } from "./safe-fetch.js";

const OK_FIRST = 200;
const OK_LAST = 299;

/**
 * The body of a web playlist, fetched once through the guarded fetch (docs/43 section 3.2): 15 s, a hard byte cap
 * that is an error and never a truncation. A failure is a fixed code, never the fetch's own message (it can carry the
 * address, and the address can carry credentials): an address the guard refuses, or a body past the cap, is a bad
 * playlist (`422 playlist.invalid`, field `url`); anything else is `503 playlist.unreachable` with the host only.
 */
export async function fetchPlaylistText(
  safeFetch: SafeFetch,
  address: string,
  options: { maxBytes: number; signal?: AbortSignal },
): Promise<string> {
  const host = new URL(address).host;
  try {
    const answer = await safeFetch(address, {
      timeoutMs: PLAYLIST_FETCH_TIMEOUT_MS,
      maxBytes: options.maxBytes,
      ...(options.signal && { signal: options.signal }),
    });
    if (answer.status < OK_FIRST || answer.status > OK_LAST) {
      throw new AppError(ERRORS.playlistUnreachable, { host, status: answer.status });
    }
    return new TextDecoder().decode(answer.body);
  } catch (error) {
    if (error instanceof AppError) throw error;
    const refused =
      error instanceof SafeFetchError &&
      ["safe_fetch.bad_url", "safe_fetch.blocked_address", "safe_fetch.redirect_refused", "safe_fetch.too_large"].includes(error.code);
    if (refused) {
      throw new AppError(ERRORS.playlistInvalid, { field: "url" }, "That web address cannot be used as a playlist.");
    }
    throw new AppError(ERRORS.playlistUnreachable, { host });
  }
}
