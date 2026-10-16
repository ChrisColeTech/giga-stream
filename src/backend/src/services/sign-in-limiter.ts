import { SIGN_IN_ATTEMPTS_PER_WINDOW, SIGN_IN_WINDOW_MS } from "../constants/limits.js";

/**
 * Sign-in attempts per address (docs/03 section 7.12): at most ten in any minute. Kept in memory, so a
 * restart clears it; the per-account lockout is in the database and survives one.
 */
export function createSignInLimiter(now: () => number) {
  const attempts = new Map<string, number[]>();
  return {
    /** Records an attempt and answers whether it is allowed. */
    allow(address: string): boolean {
      const cutoff = now() - SIGN_IN_WINDOW_MS;
      const recent = (attempts.get(address) ?? []).filter((at) => at > cutoff);
      if (recent.length >= SIGN_IN_ATTEMPTS_PER_WINDOW) {
        attempts.set(address, recent);
        return false;
      }
      recent.push(now());
      attempts.set(address, recent);
      return true;
    },
  };
}

export type SignInLimiter = ReturnType<typeof createSignInLimiter>;
